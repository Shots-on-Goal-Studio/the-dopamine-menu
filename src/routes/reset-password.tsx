import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Set a new password — Dopamine Menu" }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase parses the recovery hash and emits PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also ready if there's already a session (link already consumed).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/menu" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[480px] px-5 pt-20 pb-16">
      <h1 className="text-center" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px,8vw,64px)", color: "var(--ink)" }}>
        New password
      </h1>
      <p className="mt-3 text-center" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
        Pick something fresh.
      </p>

      <form onSubmit={submit} className="mt-10">
        <label className="block">
          <span className="block text-xs mb-1 uppercase" style={{ fontFamily: "var(--font-body)", letterSpacing: "0.15em" }}>New password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!ready}
            style={{
              fontFamily: "var(--font-body)",
              background: "transparent",
              border: "2px solid var(--ink)",
              padding: "10px 12px",
              width: "100%",
              fontSize: 15,
              color: "var(--ink)",
            }}
          />
        </label>

        {error && (
          <p className="mt-3 text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--pink)" }}>{error}</p>
        )}

        {!ready && (
          <p className="mt-3 text-xs opacity-60" style={{ fontFamily: "var(--font-body)" }}>
            Waiting for reset link… If nothing happens, request a new link from the sign-in page.
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !ready}
          className="mt-6 w-full px-5 py-3 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 disabled:opacity-50"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            background: "var(--ink)",
            color: "var(--yellow)",
            boxShadow: "5px 5px 0 var(--pink)",
            letterSpacing: "0.04em",
          }}
        >
          {busy ? "…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
