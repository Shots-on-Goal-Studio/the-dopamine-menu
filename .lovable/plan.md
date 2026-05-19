## Goal

Let users opt into up to **3 additional reminders per day** on top of the existing morning email. Default behavior is unchanged — new users still get exactly one email/day.

## UX (Account page)

Below the existing "Send at" row (only visible when daily reminders are on):

- Section: **"Extra nudges (optional)"**
- Up to 3 hour pickers, each with an "X" to remove
- "+ Add another nudge" button (hidden once 3 are picked)
- Disallow duplicates and disallow picking the same hour as the morning email
- Saves immediately, same toast pattern as the existing dropdowns

Empty state = no extras = current behavior.

## Data model

Add to `email_preferences`:

- `extra_reminder_hours smallint[] not null default '{}'` — sorted, 0–23, max length 3, no duplicates, must not contain `reminder_hour`
- `last_sent_hours jsonb not null default '{}'::jsonb` — shape `{ "date": "YYYY-MM-DD", "hours": [9, 12] }` for per-hour dedupe within a local day

`last_sent_on` is kept for backward compat but the cron switches to `last_sent_hours` for dedupe (reset whenever `date` changes).

CHECK constraints: `array_length(extra_reminder_hours, 1) <= 3`, all values between 0 and 23.

## Server functions (`src/lib/emailPrefs.functions.ts`)

- `getEmailPreferences` — also select `extra_reminder_hours`
- `setEmailPreferences` — accept optional `extraReminderHours: number[]`; Zod validates length ≤ 3, ints 0–23, unique, and not equal to `reminderHour`; sorts ascending before upsert

## New email template

`src/lib/email-templates/daily-nudge.tsx` — shorter copy than the morning email ("Quick nudge — here's something from your menu"), same brand styling, same `{ itemName, detail, category, isCustom }` props. Register in `registry.ts` as `daily-nudge`.

## Cron logic (`src/routes/api/public/cron/daily-reminders.ts`)

For each opted-in user, instead of only checking `reminder_hour`:

1. Compute the user's `localHour` and `localDate` (same as today).
2. Build `targetHours = [reminder_hour, ...extra_reminder_hours]`.
3. If `localHour` is not in `targetHours`, skip.
4. Read `last_sent_hours`. If `date !== localDate`, treat as empty. If `hours` already contains `localHour`, skip.
5. Pick template:
   - `localHour === reminder_hour` → `daily-reminder` (existing copy)
   - otherwise → `daily-nudge`
6. Idempotency key: `daily-${user_id}-${localDate}-${localHour}` (per-hour, not per-day).
7. On successful enqueue, update `last_sent_hours` to `{ date: localDate, hours: [...prevHours, localHour] }`. Also keep `last_sent_on = localDate` for any code still reading it.
8. Suppression branch also marks the hour as sent so we don't retry every 15 min.

Cron schedule (every 15 min) and the rest of the queue/suppression flow are unchanged.

## Out of scope

- Marketing-style bulk sends
- More than 3 extras
- Custom per-nudge copy

## Files touched

- `supabase` migration (new columns + constraints)
- `src/lib/emailPrefs.functions.ts`
- `src/routes/_authenticated/account.tsx`
- `src/lib/email-templates/daily-nudge.tsx` (new)
- `src/lib/email-templates/registry.ts`
- `src/routes/api/public/cron/daily-reminders.ts`
