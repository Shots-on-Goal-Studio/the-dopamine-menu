## Goal
In the admin "Users — last visit" table, show each user's daily nudge (daily reminder email) status: ON/OFF, and when ON, how many nudges per day they receive.

## What "how many" means
Each user has `email_preferences.reminder_hour` (the base hour) plus `extra_reminder_hours` (array, max 3). When `daily_reminder = true`, total nudges per day = `1 + extra_reminder_hours.length` (1–4).

## Changes

### 1. `src/lib/analytics.functions.ts` — `getUsersLastVisit`
- Add a parallel query to `supabaseAdmin.from("email_preferences").select("user_id, daily_reminder, reminder_hour, extra_reminder_hours")`.
- Build a `Map<userId, { enabled: boolean; count: number }>`. Count = `enabled ? 1 + (extra_reminder_hours?.length ?? 0) : 0`.
- Include `nudges: { enabled, count } | null` on each row (null if no prefs row exists).

### 2. `src/routes/_authenticated/admin/usage.tsx` — Users table
- Add a "Daily nudges" column after "Last sign-in".
- Render a small badge:
  - ON → green/teal badge `ON · {count}/day` (e.g. "ON · 2/day")
  - OFF → muted badge `OFF`
  - no prefs row → `—`
- Reuse existing inline style conventions (uppercase 10–11px, 2px ink border, brand colors `--teal`/opacity for muted).

## Out of scope
- No filtering/sorting by nudge status.
- No edit controls.
- No changes to email sending logic or preferences schema.
