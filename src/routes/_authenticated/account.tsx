import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { exportCsv, deleteAccount } from "@/lib/dopamine.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Account — Dopamine Menu" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const exportFn = useServerFn(exportCsv);
  const deleteFn = useServerFn(deleteAccount);
  const [user, setUser] = useState<{ email: string; name: string; avatar: string; createdAt: string } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = (u.user_metadata ?? {}) as Record<string, string>;
      setUser({
        email: u.email ?? "",
        name: meta.full_name ?? meta.name ?? u.email ?? "",
        avatar: meta.avatar_url ?? meta.picture ?? "",
        createdAt: u.created_at ?? "",
      });
    });
  }, []);

  const downloadCsv = async () => {
    try {
      const { csv } = await exportFn({ data: { timeZone: tz } });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `dopamine-menu-export-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const removeAccount = async () => {
    setBusy(true);
    try {
      await deleteFn();
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-[640px] px-5 pt-10 pb-20" style={{ fontFamily: "var(--font-body)" }}>
      <Link to="/menu" className="text-xs uppercase tracking-widest opacity-60 hover:opacity-100">← Back to menu</Link>

      <h1 className="mt-6" style={{ fontFamily: "var(--font-display)", fontSize: 44, textShadow: "5px 5px 0 var(--yellow)" }}>Account</h1>

      <section className="mt-10 p-7" style={{ border: "3px solid var(--ink)", background: "var(--cream)" }}>
        <div className="flex items-center gap-4">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--pink)", color: "var(--cream)", fontFamily: "var(--font-display)" }}>
              {(user.email || "??").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>{user.name}</div>
            <div className="text-sm opacity-70">{user.email}</div>
          </div>
        </div>
        {user.createdAt && (
          <div className="mt-4 text-xs opacity-60">Member since {new Date(user.createdAt).toLocaleDateString()}</div>
        )}
      </section>

      <section className="mt-8 grid gap-3">
        <button onClick={downloadCsv} className="px-4 py-3 text-xs uppercase" style={{ letterSpacing: "0.18em", background: "var(--ink)", color: "var(--yellow)", fontFamily: "var(--font-display)" }}>
          Export my data (CSV)
        </button>
        <button onClick={signOut} className="px-4 py-3 text-xs uppercase" style={{ letterSpacing: "0.18em", border: "2px solid var(--ink)", background: "transparent", color: "var(--ink)" }}>
          Sign out
        </button>
      </section>

      <section className="mt-12 p-6" style={{ border: "3px solid var(--pink)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--pink)" }}>Delete account</h2>
        <p className="mt-2 text-sm">Hard deletes all your logs, custom hits, and profile. No recovery.</p>
        <p className="mt-2 text-xs opacity-70">Export your data first if you want a copy.</p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="mt-4 w-full px-3 py-2"
          style={{ background: "var(--cream)", border: "2px solid var(--ink)", fontFamily: "var(--font-body)" }}
        />
        <button
          onClick={removeAccount}
          disabled={confirm !== "DELETE" || busy}
          className="mt-3 w-full px-4 py-3 text-xs uppercase disabled:opacity-40"
          style={{ letterSpacing: "0.18em", background: "var(--pink)", color: "var(--cream)", fontFamily: "var(--font-display)" }}
        >
          {busy ? "Deleting…" : "Delete account permanently"}
        </button>
      </section>
    </div>
  );
}
