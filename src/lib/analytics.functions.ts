import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const eventTypeSchema = z.enum(["roll_clicked", "menu_item_clicked", "menu_item_logged", "menu_visited"]);

export const trackEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      eventType: eventTypeSchema,
      metadata: z.record(z.string(), z.any()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("app_events").insert({
      user_id: userId,
      event_type: data.eventType,
      metadata: data.metadata ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      days: z.number().int().min(1).max(365).default(30),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Forbidden");

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    // Use admin client for cross-user aggregates
    const [logsRes, eventsRes, totalUsersRes] = await Promise.all([
      supabaseAdmin
        .from("dopamine_logs")
        .select("user_id,item_name,category,is_custom,logged_at")
        .gte("logged_at", since)
        .limit(50000),
      supabaseAdmin
        .from("app_events")
        .select("user_id,event_type,metadata,occurred_at")
        .gte("occurred_at", since)
        .limit(50000),
      supabaseAdmin.from("email_preferences").select("user_id", { count: "exact", head: true }),
    ]);

    if (logsRes.error) throw new Error(logsRes.error.message);
    if (eventsRes.error) throw new Error(eventsRes.error.message);

    const logs = logsRes.data ?? [];
    const events = eventsRes.data ?? [];

    // Daily buckets (UTC date)
    type DayBucket = { day: string; activeUsers: Set<string>; rollers: Set<string>; hits: number; rolls: number; itemClicks: number };
    const byDay = new Map<string, DayBucket>();
    const getBucket = (day: string): DayBucket => {
      let b = byDay.get(day);
      if (!b) {
        b = { day, activeUsers: new Set(), rollers: new Set(), hits: 0, rolls: 0, itemClicks: 0 };
        byDay.set(day, b);
      }
      return b;
    };

    for (const l of logs) {
      const day = (l.logged_at as string).slice(0, 10);
      const b = getBucket(day);
      if (l.user_id) b.activeUsers.add(l.user_id as string);
      b.hits += 1;
    }
    for (const e of events) {
      const day = (e.occurred_at as string).slice(0, 10);
      const b = getBucket(day);
      if (e.event_type === "roll_clicked") {
        b.rolls += 1;
        if (e.user_id) b.rollers.add(e.user_id as string);
      } else if (e.event_type === "menu_item_clicked") {
        b.itemClicks += 1;
      }
    }

    const daily = Array.from(byDay.values())
      .map((b) => ({
        day: b.day,
        activeUsers: b.activeUsers.size,
        rollers: b.rollers.size,
        hits: b.hits,
        rolls: b.rolls,
        itemClicks: b.itemClicks,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // KPIs
    const todayUtc = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dauToday = byDay.get(todayUtc)?.activeUsers.size ?? 0;
    const wauSet = new Set<string>();
    for (const [day, b] of byDay) {
      if (day >= sevenDaysAgo) for (const u of b.activeUsers) wauSet.add(u);
    }

    // Top items
    const itemCounts = new Map<string, { name: string; category: string; isCustom: boolean; count: number }>();
    for (const l of logs) {
      const key = `${l.category}::${l.item_name}::${l.is_custom}`;
      const existing = itemCounts.get(key);
      if (existing) existing.count += 1;
      else itemCounts.set(key, {
        name: l.item_name as string,
        category: l.category as string,
        isCustom: l.is_custom as boolean,
        count: 1,
      });
    }
    const topItems = Array.from(itemCounts.values()).sort((a, b) => b.count - a.count).slice(0, 15);

    // Category breakdown
    const catCounts: Record<string, number> = { quick: 0, medium: 0, big: 0 };
    for (const l of logs) {
      const c = l.category as string;
      if (c in catCounts) catCounts[c] += 1;
    }

    // Funnel totals
    const totalRolls = events.filter((e) => e.event_type === "roll_clicked").length;
    const totalItemClicks = events.filter((e) => e.event_type === "menu_item_clicked").length;
    const totalHits = logs.length;

    return {
      daily,
      kpis: {
        totalUsers: totalUsersRes.count ?? 0,
        dauToday,
        wau: wauSet.size,
        totalHits,
      },
      funnel: { rolls: totalRolls, itemClicks: totalItemClicks, hits: totalHits },
      topItems,
      categories: catCounts,
      rangeDays: data.days,
    };
  });

async function assertAdmin(ctx: { supabase: typeof supabaseAdmin; userId: string }) {
  const { data: roleRow, error: roleErr } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr) throw new Error(roleErr.message);
  if (!roleRow) throw new Error("Forbidden");
}

export const getHourlyVisits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });

    const hours = 100;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const { data, error } = await supabaseAdmin
      .from("app_events")
      .select("user_id,occurred_at")
      .eq("event_type", "menu_visited")
      .gte("occurred_at", since.toISOString())
      .limit(50000);
    if (error) throw new Error(error.message);

    // Bucket per hour (UTC, truncated to the hour)
    const buckets = new Map<string, { visits: number; users: Set<string> }>();
    for (const row of data ?? []) {
      const d = new Date(row.occurred_at as string);
      d.setUTCMinutes(0, 0, 0);
      const key = d.toISOString();
      let b = buckets.get(key);
      if (!b) { b = { visits: 0, users: new Set() }; buckets.set(key, b); }
      b.visits += 1;
      if (row.user_id) b.users.add(row.user_id as string);
    }

    // Zero-fill the last `hours` slots
    const nowHour = new Date();
    nowHour.setUTCMinutes(0, 0, 0);
    const series: { hour: string; label: string; visits: number; uniqueUsers: number }[] = [];
    for (let i = hours - 1; i >= 0; i--) {
      const t = new Date(nowHour.getTime() - i * 60 * 60 * 1000);
      const key = t.toISOString();
      const b = buckets.get(key);
      series.push({
        hour: key,
        label: `${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")} ${String(t.getUTCHours()).padStart(2, "0")}h`,
        visits: b?.visits ?? 0,
        uniqueUsers: b?.users.size ?? 0,
      });
    }

    return { series };
  });

export const getUsersLastVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin({ supabase: context.supabase as never, userId: context.userId });

    // List users (single page; fine for current scale)
    const { data: usersRes, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersErr) throw new Error(usersErr.message);

    // Pull recent visit events (last 90 days) + nudge prefs in parallel
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [eventsRes, prefsRes] = await Promise.all([
      supabaseAdmin
        .from("app_events")
        .select("user_id,occurred_at")
        .eq("event_type", "menu_visited")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(50000),
      supabaseAdmin
        .from("email_preferences")
        .select("user_id,daily_reminder,extra_reminder_hours"),
    ]);
    if (eventsRes.error) throw new Error(eventsRes.error.message);
    if (prefsRes.error) throw new Error(prefsRes.error.message);

    const lastByUser = new Map<string, string>();
    for (const ev of eventsRes.data ?? []) {
      const uid = ev.user_id as string | null;
      if (!uid) continue;
      if (!lastByUser.has(uid)) lastByUser.set(uid, ev.occurred_at as string);
    }

    const nudgesByUser = new Map<string, { enabled: boolean; count: number }>();
    for (const p of prefsRes.data ?? []) {
      const enabled = !!p.daily_reminder;
      const extras = Array.isArray(p.extra_reminder_hours) ? p.extra_reminder_hours.length : 0;
      nudgesByUser.set(p.user_id as string, {
        enabled,
        count: enabled ? 1 + extras : 0,
      });
    }

    const rows = (usersRes.users ?? []).map((u) => ({
      userId: u.id,
      email: u.email ?? "(no email)",
      lastVisit: lastByUser.get(u.id) ?? null,
      lastSignIn: u.last_sign_in_at ?? null,
      createdAt: u.created_at,
      nudges: nudgesByUser.get(u.id) ?? null,
    }));

    rows.sort((a, b) => {
      if (a.lastVisit && b.lastVisit) return b.lastVisit.localeCompare(a.lastVisit);
      if (a.lastVisit) return -1;
      if (b.lastVisit) return 1;
      return (b.lastSignIn ?? "").localeCompare(a.lastSignIn ?? "");
    });

    return { users: rows };
  });
