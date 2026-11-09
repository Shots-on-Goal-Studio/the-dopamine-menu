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
import { AppError } from '@/components/AppError';

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

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return <AppError error={error} onRetry={() => {
    reset();
    void router.invalidate().catch((cause: unknown) => console.error('Menu retry failed', cause));
  }} />;
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
      // Defer work until the auth callback has released its session lock.
      setTimeout(() => {
        void router.invalidate().catch((cause: unknown) => console.error('Auth navigation refresh failed', cause));
        void qc.invalidateQueries().catch((cause: unknown) => console.error('Auth data refresh failed', cause));
      }, 0);
      if (event === "SIGNED_IN" && session?.user?.email) {
        // Fire-and-forget so welcome email never blocks navigation/hydration.
        setTimeout(async () => {
          try {
            const { sendWelcomeEmail } = await import("@/lib/email/welcome.functions");
            const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
            await sendWelcomeEmail({ data: { timezone: tz } });
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
