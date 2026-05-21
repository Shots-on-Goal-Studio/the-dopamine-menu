import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBalloonPopsTotal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("balloon_pop_counters")
      .select("total")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { total: Number(data?.total ?? 0) };
  });

export const incrementBalloonPops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ delta: z.number().int().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: readErr } = await supabase
      .from("balloon_pop_counters")
      .select("total")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    const nextTotal = Number(existing?.total ?? 0) + data.delta;
    const { error: upsertErr } = await supabase
      .from("balloon_pop_counters")
      .upsert(
        { user_id: userId, total: nextTotal, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (upsertErr) throw new Error(upsertErr.message);
    return { total: nextTotal };
  });
