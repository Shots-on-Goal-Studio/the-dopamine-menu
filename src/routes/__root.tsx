import { useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { StudioFooter } from "@/components/StudioFooter";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl" style={{ fontFamily: "var(--font-display)" }}>404</h1>
        <p className="mt-4" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          That page rolled out of the menu.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block px-4 py-2"
          style={{ background: "var(--ink)", color: "var(--yellow)", fontFamily: "var(--font-display)" }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 style={{ fontFamily: "var(--font-display)" }}>Something broke</h1>
        <p className="mt-2 text-sm">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 px-4 py-2"
          style={{ background: "var(--ink)", color: "var(--yellow)", fontFamily: "var(--font-display)" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dopamine Menu — Healthy hits, on tap." },
      { name: "description", content: "A personal, gamified menu of healthy dopamine sources for ADHD adults. Pick one, or let chance decide." },
      { property: "og:title", content: "Dopamine Menu — Healthy hits, on tap." },
      { property: "og:description", content: "A personal, gamified menu of healthy dopamine sources for ADHD adults. Pick one, or let chance decide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Dopamine Menu — Healthy hits, on tap." },
      { name: "twitter:description", content: "A personal, gamified menu of healthy dopamine sources for ADHD adults. Pick one, or let chance decide." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/IW3Rr6ksi1WNssq4EWEBQtL7o4a2/social-images/social-1779132057190-Dopamine_2.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/IW3Rr6ksi1WNssq4EWEBQtL7o4a2/social-images/social-1779132057190-Dopamine_2.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bungee&family=DM+Mono:wght@400;500&family=DM+Serif+Display:ital@0;1&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function AuthListener() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      router.invalidate();
      qc.invalidateQueries();
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const onboarded = localStorage.getItem("dm.onboarded") === "1";
          const path = window.location.pathname;
          const skip = ["/welcome", "/account", "/admin"].some((p) => path.startsWith(p));
          if (!onboarded && !skip) {
            router.navigate({ to: "/welcome" });
          }
        } catch {
          // ignore
        }
      }
      if (event === "SIGNED_IN" && session?.user?.email) {
        // Fire-and-forget so welcome email never blocks navigation/hydration.
        setTimeout(async () => {
          try {
            const { getEmailPreferences, markWelcomeSent } = await import("@/lib/emailPrefs.functions");
            const { sendTransactionalEmail } = await import("@/lib/email/send");
            const prefs = await getEmailPreferences();
            if (!prefs?.welcome_sent_at) {
              const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
              await sendTransactionalEmail({
                templateName: "welcome",
                recipientEmail: session.user.email!,
                idempotencyKey: `welcome-${session.user.id}`,
              });
              await markWelcomeSent({ data: { timezone: tz } });
            }
          } catch (err) {
            console.error("welcome email send failed", err);
          }
        }, 0);
      }
      if (session?.user) {
        setTimeout(async () => {
          try {
            const { isEnabled, getPermission, scheduleTodayNotifications } = await import("@/lib/browserNotifications");
            if (!isEnabled() || getPermission() !== "granted") return;
            const { getEmailPreferences } = await import("@/lib/emailPrefs.functions");
            const prefs = await getEmailPreferences();
            if (!prefs?.daily_reminder) return;
            const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
            scheduleTodayNotifications({
              baseHour: prefs.reminder_hour ?? 9,
              extraHours: Array.isArray(prefs.extra_reminder_hours) ? prefs.extra_reminder_hours : [],
              timezone: prefs.timezone || tz,
            });
          } catch (err) {
            console.error("schedule browser notifications failed", err);
          }
        }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">
          <Outlet />
        </main>
        <StudioFooter
          productName="Dopamine Menu"
          tagline="Healthy hits, on tap."
          icon="🎲"
          iconColorVar="--pink"
        />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
