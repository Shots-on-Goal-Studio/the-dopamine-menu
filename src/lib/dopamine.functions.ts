import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeStreak } from "@/lib/streak";

const categorySchema = z.enum(["quick", "medium", "big"]);

// ---------- Read: logs + custom hits in one round-trip ----------
export const getMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [logsRes, hitsRes] = await Promise.all([
      supabase
        .from("dopamine_logs")
        .select("id,item_name,category,is_custom,streak_at_time,logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(1000),
      supabase
        .from("custom_hits")
        .select("id,name,detail,category,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    if (logsRes.error) throw new Error(logsRes.error.message);
    if (hitsRes.error) throw new Error(hitsRes.error.message);
    return { logs: logsRes.data ?? [], customHits: hitsRes.data ?? [] };
  });

// ---------- Commit a hit ----------
export const commitHit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        itemName: z.string().min(1).max(120),
        category: categorySchema,
        isCustom: z.boolean(),
        timeZone: z.string().min(1).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Pull recent logs (90 days is plenty for streak math)
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data: recent, error: readErr } = await supabase
      .from("dopamine_logs")
      .select("logged_at")
      .eq("user_id", userId)
      .gte("logged_at", since);
    if (readErr) throw new Error(readErr.message);

    // Compute streak as it would be after this commit by appending today.
    const projected = [...(recent ?? []), { logged_at: new Date().toISOString() }];
    const streakAfter = computeStreak(projected, data.timeZone);

    const { error: insertErr } = await supabase.from("dopamine_logs").insert({
      user_id: userId,
      item_name: data.itemName,
      category: data.category,
      is_custom: data.isCustom,
      streak_at_time: streakAfter,
    });
    if (insertErr) throw new Error(insertErr.message);

    return { streak: streakAfter };
  });

// ---------- Add custom hit ----------
export const addCustomHit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(1).max(60),
        detail: z.string().trim().max(60).optional().nullable(),
        category: categorySchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const detail = data.detail && data.detail.length > 0 ? data.detail : null;
    const { data: row, error } = await supabase
      .from("custom_hits")
      .insert({
        user_id: userId,
        name: data.name,
        detail,
        category: data.category,
      })
      .select("id,name,detail,category,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { customHit: row };
  });

// ---------- Delete custom hit ----------
export const deleteCustomHit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("custom_hits")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- CSV export ----------
export const exportCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ timeZone: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: logs, error } = await supabase
      .from("dopamine_logs")
      .select("item_name,category,is_custom,streak_at_time,logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false });
    if (error) throw new Error(error.message);

    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: data.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const catLabel: Record<string, string> = { quick: "Quick", medium: "Medium", big: "Big" };

    const escape = (v: string) =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

    const header = ["Logged At", "Item", "Category", "Custom?", "Streak at Time"];
    const rows = (logs ?? []).map((l) =>
      [
        fmt.format(new Date(l.logged_at)),
        l.item_name,
        catLabel[l.category] ?? l.category,
        l.is_custom ? "yes" : "no",
        String(l.streak_at_time),
      ]
        .map(escape)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    return { csv };
  });

// ---------- Delete account (hard) ----------
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cascade FKs handle dopamine_logs / custom_hits, but be explicit.
    await supabaseAdmin.from("dopamine_logs").delete().eq("user_id", userId);
    await supabaseAdmin.from("custom_hits").delete().eq("user_id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
