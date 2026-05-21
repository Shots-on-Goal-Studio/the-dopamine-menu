// Local (no-backend) browser notifications that fire at the same hours the
// user has configured for daily email reminders. Best-effort: works only while
// the tab/PWA is open. Dedupes per local date via localStorage.

const ENABLED_KEY = "dm.browserNotifications";
const FIRED_KEY = "dm.browserNotifications.fired"; // { date: "YYYY-MM-DD", hours: number[] }

let timers: ReturnType<typeof setTimeout>[] = [];

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): NotificationPermission | "unsupported" {
  if (!isSupported()) return "unsupported";
  return Notification.permission;
}

export function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function setEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function getTzParts(tz: string, at: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "UTC",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
  };
}

function msUntilHour(targetHour: number, tz: string, now = Date.now()): number {
  const p = getTzParts(tz, new Date(now));
  let diffH = (targetHour - p.hour + 24) % 24;
  if (diffH === 0 && (p.minute > 0 || p.second > 0)) diffH = 24;
  return diffH * 3_600_000 - p.minute * 60_000 - p.second * 1000;
}

function readFired(date: string): number[] {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { date?: string; hours?: number[] };
    if (parsed.date !== date) return [];
    return Array.isArray(parsed.hours) ? parsed.hours : [];
  } catch {
    return [];
  }
}

function markFired(date: string, hour: number) {
  const hours = Array.from(new Set([...readFired(date), hour])).sort((a, b) => a - b);
  localStorage.setItem(FIRED_KEY, JSON.stringify({ date, hours }));
}

function showNotification(isExtra: boolean) {
  if (!isSupported() || Notification.permission !== "granted") return;
  const title = isExtra ? "Quick nudge ☄️" : "Dopamine Menu 🎲";
  const body = isExtra
    ? "Two minutes — pick one tiny hit."
    : "Time for a healthy dopamine hit. Open the menu.";
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "dopamine-menu-nudge",
    });
    n.onclick = () => {
      try {
        window.focus();
        if (window.location.pathname !== "/menu") {
          window.location.href = "/menu";
        }
        n.close();
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

export function cancelAllScheduled() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

export function scheduleTodayNotifications(opts: {
  baseHour: number;
  extraHours: number[];
  timezone: string;
}) {
  cancelAllScheduled();
  if (!isSupported() || Notification.permission !== "granted" || !isEnabled()) return;

  const tz = opts.timezone || "UTC";
  const now = Date.now();
  const today = getTzParts(tz, new Date(now)).date;
  const alreadyFired = new Set(readFired(today));

  const slots: Array<{ hour: number; isExtra: boolean }> = [
    { hour: opts.baseHour, isExtra: false },
    ...opts.extraHours.map((h) => ({ hour: h, isExtra: true })),
  ];

  const horizon = 24 * 3_600_000 + 60_000; // ~24h

  for (const slot of slots) {
    const ms = msUntilHour(slot.hour, tz, now);
    if (ms <= 0 || ms > horizon) continue;
    // Skip if we already fired this hour today (and it's still the same day in tz)
    const fireDate = getTzParts(tz, new Date(now + ms)).date;
    if (fireDate === today && alreadyFired.has(slot.hour)) continue;
    const timer = setTimeout(() => {
      showNotification(slot.isExtra);
      markFired(fireDate, slot.hour);
    }, ms);
    timers.push(timer);
  }

  // Reschedule shortly after local midnight to arm tomorrow's slots.
  const msToMidnight = msUntilHour(0, tz, now);
  const midnightTimer = setTimeout(() => {
    scheduleTodayNotifications(opts);
  }, msToMidnight + 5_000);
  timers.push(midnightTimer);
}
