import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBalloonPopsTotal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count, error } = await supabase
      .from("dopamine_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_name", "Pop a Balloon");
    if (error) throw new Error(error.message);
    return { total: count ?? 0 };
  });
