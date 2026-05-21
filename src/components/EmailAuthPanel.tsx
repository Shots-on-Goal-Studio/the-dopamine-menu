import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = "signin" | "signup" | "forgot";

export function EmailAuthPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    background: "transparent",
    border: "2px solid var(--ink)",
    padding: "10px 12px",
    width: "100%",
    fontSize: 15,
    color: "var(--ink)",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/menu" });
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/menu" });
        } else {
          setSentTo(email.trim());
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setResetSent(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3 text-xs opacity-50" style={{ fontFamily: "var(--font-body)", letterSpacing: "0.2em" }}>
          <span className="h-px w-10" style={{ background: "var(--ink)" }} />
          OR
          <span className="h-px w-10" style={{ background: "var(--ink)" }} />
        </div>
        <button
          onClick={() => setOpen(true)}
          className="text-sm underline underline-offset-4 hover:opacity-70"
          style={{ fontFamily: "var(--font-body)", color: "var(--ink)" }}
        >
          Continue with email
        </button>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="mx-auto mt-10 max-w-[380px] text-left">
        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18 }}>
          Check <span style={{ color: "var(--pink)" }}>{sentTo}</span> to confirm your account.
        </p>
        <button
          onClick={() => { setSentTo(null); setMode("signin"); setPassword(""); }}
          className="mt-4 text-xs underline underline-offset-4 opacity-70"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (mode === "forgot" && resetSent) {
    return (
      <div className="mx-auto mt-10 max-w-[380px] text-left">
        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 18 }}>
          If an account exists for <span style={{ color: "var(--pink)" }}>{email}</span>, a reset link is on its way.
        </p>
        <button
          onClick={() => { setResetSent(false); setMode("signin"); }}
          className="mt-4 text-xs underline underline-offset-4 opacity-70"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-[380px] text-left">
      <div className="flex items-center gap-3 text-xs opacity-50 mb-5" style={{ fontFamily: "var(--font-body)", letterSpacing: "0.2em" }}>
        <span className="h-px flex-1" style={{ background: "var(--ink)" }} />
        OR EMAIL
        <span className="h-px flex-1" style={{ background: "var(--ink)" }} />
      </div>

      <label className="block mb-3">
        <span className="block text-xs mb-1 uppercase" style={{ fontFamily: "var(--font-body)", letterSpacing: "0.15em" }}>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </label>

      {mode !== "forgot" && (
        <label className="block mb-3">
          <span className="block text-xs mb-1 uppercase" style={{ fontFamily: "var(--font-body)", letterSpacing: "0.15em" }}>Password</span>
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {mode === "signup" && (
            <span className="mt-1 block text-[11px] opacity-60" style={{ fontFamily: "var(--font-body)" }}>
              8+ characters. We check against known breached passwords.
            </span>
          )}
        </label>
      )}

      {error && (
        <p className="mb-3 text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--pink)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full px-5 py-3 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 disabled:opacity-60"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 16,
          background: "var(--ink)",
          color: "var(--yellow)",
          boxShadow: "5px 5px 0 var(--pink)",
          letterSpacing: "0.04em",
        }}
      >
        {busy ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
      </button>

      <div className="mt-4 flex items-center justify-between text-xs" style={{ fontFamily: "var(--font-body)" }}>
        {mode === "signin" && (
          <>
            <button type="button" onClick={() => { setMode("signup"); setError(null); }} className="underline underline-offset-4 opacity-80 hover:opacity-100">
              No account? Create one
            </button>
            <button type="button" onClick={() => { setMode("forgot"); setError(null); }} className="underline underline-offset-4 opacity-60 hover:opacity-100">
              Forgot password?
            </button>
          </>
        )}
        {mode === "signup" && (
          <button type="button" onClick={() => { setMode("signin"); setError(null); }} className="underline underline-offset-4 opacity-80 hover:opacity-100">
            Already have an account? Sign in
          </button>
        )}
        {mode === "forgot" && (
          <button type="button" onClick={() => { setMode("signin"); setError(null); }} className="underline underline-offset-4 opacity-80 hover:opacity-100">
            Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}
