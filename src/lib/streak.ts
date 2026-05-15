// Pure streak utilities. Used both client-side (display) and server-side
// (computing streak_at_time at log-insert).
//
// Definition: consecutive days with ≥1 log working back from today, with one
// silent grace day allowed per rolling 7-day window. Grace is never surfaced
// in the UI.

export type LogLike = { logged_at: string };

/** Convert an ISO timestamp to a YYYY-MM-DD key in the given IANA timezone. */
export function localDateKey(iso: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso));
}

/** YYYY-MM-DD for today in the given timezone. */
export function todayKey(timeZone: string): string {
  return localDateKey(new Date().toISOString(), timeZone);
}

/** Subtract `days` from a YYYY-MM-DD key (UTC math; date-only). */
function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Compute current streak from logs.
 * Walks back from today; consecutive days with ≥1 log; one missed day per
 * rolling 7-day window forgiven silently.
 */
export function computeStreak(logs: LogLike[], timeZone: string): number {
  const today = todayKey(timeZone);
  const days = new Set(logs.map((l) => localDateKey(l.logged_at, timeZone)));

  // If no log today AND no log yesterday, streak might still hold via grace
  // only when the user logged today previously? In practice, if they haven't
  // logged today the streak is what it was at end of yesterday.
  // Walk back, counting consecutive days; allow one skip per any window of 7.
  let streak = 0;
  // Maintain a rolling list of the last 7 day-offsets we've inspected; count skips.
  const recentSkips: number[] = []; // offsets (days back) where day was missed
  for (let offset = 0; offset < 365; offset++) {
    const key = shiftKey(today, -offset);
    // Drop skips that fall out of the rolling 7-day window
    while (recentSkips.length && recentSkips[0] < offset - 6) recentSkips.shift();

    if (days.has(key)) {
      streak++;
      continue;
    }

    // Missed day. Today's miss does NOT break — just don't count today.
    if (offset === 0) continue;

    // Can we use grace? Only if no skip exists in the last 7-day rolling window.
    if (recentSkips.length === 0) {
      recentSkips.push(offset);
      continue; // skip this day, streak preserved
    }

    // Streak ends here.
    break;
  }
  return streak;
}

/** Build the 7-day strip (oldest → today) with done/today flags. */
export type StripDay = { key: string; label: string; done: boolean; today: boolean };

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function buildWeekStrip(logs: LogLike[], timeZone: string): StripDay[] {
  const today = todayKey(timeZone);
  const days = new Set(logs.map((l) => localDateKey(l.logged_at, timeZone)));
  const strip: StripDay[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const key = shiftKey(today, -offset);
    const [y, m, d] = key.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    strip.push({
      key,
      label: DAY_LABELS[dow],
      done: days.has(key),
      today: offset === 0,
    });
  }
  return strip;
}
