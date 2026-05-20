import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function Userbar({ streak }: { streak: number | undefined }) {
  const [email, setEmail] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  const initials = (email || "??").slice(0, 2).toUpperCase();
  const streakLabel = streak === undefined ? "—" : streak;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3" style={{ background: "var(--ink)", color: "var(--cream)" }}>
      <Link to="/menu" style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.04em", color: "var(--cream)" }}>
        <span style={{ color: "var(--yellow)", marginRight: 8 }}>●</span> Dopamine Menu
      </Link>
      <div className="flex items-center gap-4">
        <div style={{ fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.08em", color: "var(--yellow)" }}>
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18, marginRight: 4, fontVariantNumeric: "tabular-nums" }}>{streakLabel}</span>
          day <span className="hidden sm:inline">streak </span>🔥
        </div>
        <Link to="/account" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--pink)", color: "var(--cream)", fontFamily: "var(--font-display)", fontSize: 13 }}>
          {initials}
        </Link>
      </div>
    </div>
  );
}
