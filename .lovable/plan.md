# Daily reminder — pick your time

Let each user choose the hour of day (in their local timezone) when the daily reminder email arrives. Default is 9 AM local. Range 0–23, hourly granularity.

## Database

Add one column to `email_preferences`:
- `reminder_hour smallint not null default 9` with `check (reminder_hour between 0 and 23)`

Backfill existing rows to `9`.

## Server functions (`src/lib/emailPrefs.functions.ts`)

- `getEmailPreferences` — also return `reminder_hour`.
- `setEmailPreferences` — accept optional `reminderHour: z.number().int().min(0).max(23)` and persist it. Keeps existing `dailyReminder` + `timezone` fields.

## Cron route (`src/routes/api/public/cron/daily-reminders.ts`)

- Select `reminder_hour` along with the other fields.
- Replace the hard-coded `localHour !== 8` check with `localHour !== p.reminder_hour`.
- No change to cron cadence (still every 15 min) — the per-user hour gate handles delivery time.

## Account UI (`src/routes/_authenticated/account.tsx`)

Under the existing "Daily reminder" toggle, when the toggle is on, show a "Send at" select:
- Native-styled Select with 24 options ("12:00 AM" … "11:00 PM"), labels shown in the user's locale.
- Default selection: `9` (9:00 AM) for users with no saved value.
- Helper text: "Times are in your local timezone ({detected tz})."
- Saving the select calls `setEmailPreferences({ dailyReminder, timezone, reminderHour })` and toasts on success.

## Email template

No changes — only delivery time shifts.

## Notes

- Hourly granularity matches the cron's 15-minute cadence comfortably (the local-hour gate fires once per hour per user, and `last_sent_on` prevents duplicates within the day).
- Sub-hour precision would require a finer cron + a `reminder_minute` column; out of scope unless requested.
