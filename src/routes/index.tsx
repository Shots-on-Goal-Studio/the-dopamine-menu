import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dopamine Menu — Healthy hits, on tap." },
      { name: "description", content: "Pick a healthy hit. Or let chance decide. A gamified menu for ADHD adults." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) navigate({ to: "/menu" });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  const signIn = async () => {
    setSigningIn(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Sign-in failed");
      setSigningIn(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/menu" });
  };

  if (checking) return null;

  return (
    <div className="mx-auto max-w-[880px] px-5 pt-20 pb-16">
      <div className="text-center">
        <div
          className="mb-5 text-[11px] uppercase"
          style={{ letterSpacing: "0.4em", color: "var(--pink)", fontFamily: "var(--font-body)" }}
        >
          — Today's Menu —
        </div>
        <h1
          className="leading-[0.95]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(56px, 11vw, 112px)",
            textShadow: "7px 7px 0 var(--yellow)",
            color: "var(--ink)",
          }}
        >
          Dopamine
        </h1>
        <p
          className="mt-6 text-[20px]"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
        >
          Pick a healthy hit. Or let <span style={{ color: "var(--pink)" }}>chance</span> decide.
        </p>

        <div className="mt-16">
          <button
            onClick={signIn}
            disabled={signingIn}
            className="px-12 py-6 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 disabled:opacity-60"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              background: "var(--ink)",
              color: "var(--yellow)",
              boxShadow: "8px 8px 0 var(--pink)",
              letterSpacing: "0.04em",
            }}
          >
            {signingIn ? "Opening Google…" : "Sign in with Google"}
          </button>
        </div>

        <p className="mt-8 text-xs opacity-60" style={{ fontFamily: "var(--font-body)" }}>
          Personal, persistent, forgiving. No shame on missed days.
        </p>
      </div>
    </div>
  );
}
