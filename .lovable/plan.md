## Goal
Send browser (Web Push / Notifications API) notifications at the same hours the user has configured for daily email nudges (`reminder_hour` + `extra_reminder_hours`), as an opt-in addition — emails keep working as today.

## Two implementation options

### Option A — Local-only notifications (recommended first step)
Pure client-side using the Notifications API + a Service Worker timer. **No backend, no extra infra.**

- Works only while the user has the site/PWA open (or installed as PWA on desktop/Android with SW running).
- Zero cost, zero secrets, ships in one pass.
- Doesn't work on iOS Safari unless installed to home screen as PWA.

### Option B — True Web Push (works when tab is closed)
Backend-driven push using VAPID + the existing daily-reminders cron.

- Works in background on Chrome/Firefox/Edge and iOS 16.4+ PWA.
- Requires: VAPID key pair (secrets), a `push_subscriptions` table, and extending the cron to also POST to push endpoints.
- More moving parts, ongoing delivery responsibility.

**Recommendation:** Ship Option A now. Add Option B later if users ask for closed-tab delivery.

---

## Plan for Option A (local notifications)

### 1. New: `src/lib/browserNotifications.ts`
- `requestPermission()` — wrap `Notification.requestPermission()`.
- `scheduleTodayNotifications(hours: number[], timezone: string)` — compute next fire times for each hour in the user's tz; for each future hour today, `setTimeout` to show a notification; persist next-fire metadata in `localStorage` so we don't double-fire across reloads.
- `cancelAllScheduled()` — clear timers.
- Notification copy: base hour → "Time for a dopamine hit 🎲", extra hours → "Quick nudge — pick one ☄️". Clicking opens `/menu`.

### 2. Account page (`src/routes/_authenticated/account.tsx`)
Add a new "Browser notifications" row under the existing email-reminder block:
- Toggle: "Also send browser notifications at these times".
- Shows current permission state; if `default`, toggling triggers the permission prompt.
- If `denied`, show a small hint with instructions to enable in browser settings.
- Persist the toggle in `localStorage` (key: `dm.browserNotifications`) — no DB change needed for Option A.
- When toggled on or when reminder hours change, call `scheduleTodayNotifications`.

### 3. Root listener (`src/routes/__root.tsx` or a small mounted hook)
On app load, if the toggle is on and permission is `granted`, read current prefs via `getEmailPreferences()` and (re)schedule today's notifications. Also reschedule at midnight (timer) so tomorrow's hours arm correctly.

### 4. Out of scope
- No service worker registration / no push subscriptions.
- No DB schema changes.
- No changes to email sending / cron.
- No notification content personalization beyond the static copy above.

---

## Technical notes
- All scheduling is local-clock based on the user's `timezone` already stored in `email_preferences`. If the device tz differs, we use the stored tz (matches what the email cron uses) so users see the notification at the same wall-clock time.
- Timers are capped at ~24h horizon; a single midnight timer reschedules.
- We dedupe via `localStorage` map `{ "YYYY-MM-DD": [firedHours] }` so multiple tabs / reloads don't trigger duplicates.

## Open question
Do you want me to go with **Option A** (local-only, ships now) or set up **Option B** (true Web Push that works with the tab closed, requires VAPID + a small backend addition)?
