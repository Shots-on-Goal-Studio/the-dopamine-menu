import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getEmailPreferences } from "@/lib/emailPrefs.functions";
import {
  isSupported as notifSupported,
  getPermission as notifGetPermission,
  requestPermission as notifRequestPermission,
  setEnabled as notifSetEnabled,
  scheduleTodayNotifications,
} from "@/lib/browserNotifications";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({ meta: [{ title: "Welcome — Dopamine Menu" }] }),
  component: WelcomePage,
});

function markOnboarded() {
  try {
    localStorage.setItem("dm.onboarded", "1");
  } catch {
    // ignore
  }
}

function WelcomePage() {
  const navigate = useNavigate();
  const getPrefs = useServerFn(getEmailPreferences);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const tz =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  useEffect(() => {
    setPerm(notifGetPermission());
  }, []);

  const enableNudges = async () => {
    if (!notifSupported()) {
      toast.error("This browser doesn't support notifications");
      return;
    }
    setEnabling(true);
    try {
      const granted = await notifRequestPermission();
      setPerm(granted);
      if (granted !== "granted") {
        toast.error("Notifications blocked — enable them in your browser settings");
        return;
      }
      notifSetEnabled(true);
      try {
        const prefs = await getPrefs();
        scheduleTodayNotifications({
          baseHour: prefs.reminder_hour ?? 9,
          extraHours: Array.isArray(prefs.extra_reminder_hours) ? prefs.extra_reminder_hours : [],
          timezone: prefs.timezone || tz,
        });
      } catch {
        scheduleTodayNotifications({ baseHour: 9, extraHours: [], timezone: tz });
      }
      setEnabled(true);
      toast.success("Browser nudges on");
    } finally {
      setEnabling(false);
    }
  };

  const finish = () => {
    markOnboarded();
    navigate({ to: "/menu" });
  };

  const nudgesOn = enabled && perm === "granted";

  return (
    <div className="mx-auto max-w-[640px] px-5 pt-10 pb-20" style={{ fontFamily: "var(--font-body)" }}>
      <div className="text-center">
        <div
          className="mb-4 text-[11px] uppercase"
          style={{ letterSpacing: "0.4em", color: "var(--pink)" }}
        >
          — Welcome —
        </div>
        <h1
          className="leading-[0.95]"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(40px, 7vw, 64px)",
            textShadow: "5px 5px 0 var(--yellow)",
            color: "var(--ink)",
          }}
        >
          Your Dopamine Menu 🎲
        </h1>
        <p
          className="mt-5 text-[18px]"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
        >
          Two quick things, then you're in.
        </p>
      </div>

      <section className="mt-10 p-7" style={{ border: "3px solid var(--ink)", background: "var(--cream)" }}>
        <div className="text-[11px] uppercase opacity-60" style={{ letterSpacing: "0.18em" }}>
          Step 1
        </div>
        <h2 className="mt-1" style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
          Turn on browser nudges
        </h2>
        <p className="mt-2 text-sm opacity-80">
          A gentle ping at your nudge times to pick a healthy hit. Works while this site (or PWA)
          is open in a tab.
        </p>

        <button
          type="button"
          onClick={enableNudges}
          disabled={enabling || nudgesOn || perm === "unsupported"}
          className="mt-5 px-6 py-4 text-sm uppercase disabled:opacity-70"
          style={{
            letterSpacing: "0.18em",
            background: nudgesOn ? "var(--teal)" : "var(--ink)",
            color: nudgesOn ? "var(--ink)" : "var(--yellow)",
            fontFamily: "var(--font-display)",
            boxShadow: nudgesOn ? "none" : "5px 5px 0 var(--pink)",
            border: nudgesOn ? "3px solid var(--ink)" : "none",
          }}
        >
          {nudgesOn
            ? "Browser nudges on ✓"
            : enabling
              ? "Asking your browser…"
              : "Enable browser nudges"}
        </button>

        {perm === "denied" ? (
          <div className="mt-3 text-xs" style={{ color: "var(--pink)" }}>
            Notifications are blocked. Enable them in your browser's site settings, then try again.
          </div>
        ) : perm === "unsupported" ? (
          <div className="mt-3 text-xs opacity-70">
            This browser doesn't support notifications — no worries, you'll still get the email.
          </div>
        ) : null}
      </section>

      <section className="mt-6 p-6" style={{ border: "3px solid var(--ink)", background: "var(--yellow)" }}>
        <div className="text-[11px] uppercase opacity-70" style={{ letterSpacing: "0.18em" }}>
          Step 2 — already on
        </div>
        <h2 className="mt-1 flex items-center gap-2" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
          📬 Daily email reminder
        </h2>
        <p className="mt-2 text-sm">
          You'll get one short email each morning with a random pick from your menu. Want extra
          nudges, a different time, or to turn it off? Head to{" "}
          <Link
            to="/account"
            className="underline"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
            onClick={markOnboarded}
          >
            Account
          </Link>
          .
        </p>
      </section>

      <section className="mt-10 grid gap-3">
        <button
          onClick={finish}
          className="px-4 py-4 text-sm uppercase"
          style={{
            letterSpacing: "0.18em",
            background: "var(--ink)",
            color: "var(--yellow)",
            fontFamily: "var(--font-display)",
            boxShadow: "5px 5px 0 var(--pink)",
          }}
        >
          Take me to my menu →
        </button>
        <button
          onClick={finish}
          className="px-4 py-3 text-xs uppercase"
          style={{
            letterSpacing: "0.18em",
            border: "2px solid var(--ink)",
            background: "transparent",
            color: "var(--ink)",
            fontFamily: "var(--font-display)",
          }}
        >
          Skip for now
        </button>
      </section>
    </div>
  );
}
