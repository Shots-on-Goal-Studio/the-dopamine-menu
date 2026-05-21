import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthLoading } from "@/components/AuthLoading";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ok" | "out">("checking");

  useEffect(() => {
    let cancelled = false;

    // Subscribe FIRST so we catch INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setStatus(session ? "ok" : "out");
    });

    // Then ask for current session as a fallback (in case listener doesn't fire fast).
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session) setStatus("ok");
        // If null, wait for the listener — don't redirect yet.
      })
      .catch(() => {
        // Network/JWT hiccup: let the listener decide; if nothing arrives, fall through after timeout.
      });

    // Safety timeout: if no answer in 2.5s, treat as signed-out.
    const timeout = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "checking" ? "out" : s));
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === "out") navigate({ to: "/" });
  }, [status, navigate]);

  if (status === "checking") return <AuthLoading />;
  if (status !== "ok") return <AuthLoading />;
  return <Outlet />;
}
