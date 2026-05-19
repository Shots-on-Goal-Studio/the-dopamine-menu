## Backfill today's missed daily reminders

Run a one-off script that calls the now-fixed cron route once per affected timezone, after temporarily forcing the "due hour" check to match. Simpler approach: run inline enqueue logic against the 12 users whose 9 AM local window already passed today.

### Target users (12)

Users with `daily_reminder = true`, `last_sent_on IS NULL`, in these timezones whose 9 AM local has already passed at the current UTC time:
- `UTC` (5 users) — 9 AM UTC passed at 09:00
- `America/New_York` (5 users) — 9 AM ET passed at 13:00 UTC
- `Europe/Helsinki` (1 user) — 9 AM passed at 06:00 UTC
- `Europe/Vilnius` (1 user) — 9 AM passed at 06:00 UTC

Excluded: Chicago and LA users — their 9 AM hasn't happened yet today; the fixed cron will pick them up.

### Script behavior (`/tmp/backfill-daily.ts`)

For each target user, mirror the cron route's per-user logic exactly:
1. Look up email via `supabase.auth.admin.getUserById`.
2. Skip if in `suppressed_emails`.
3. Get-or-create `email_unsubscribe_tokens` row.
4. Pull `custom_hits`, build pool with `SEED_MENU`, pick one random item.
5. Render `daily-reminder` template → HTML + text.
6. Insert `pending` row into `email_send_log`.
7. Call `enqueue_email` RPC with the same payload shape (`From: Dopamine Menu <noreply@dopamine.shotsongoal.studio>`, `sender_domain: notify.dopamine.shotsongoal.studio`, `idempotency_key: daily-<user_id>-<localDate>`).
8. Update `email_preferences.last_sent_on = localDate`.

Process in parallel. Idempotency key prevents duplicates if the fixed cron also fires for the same user-day.

### Verify after run

- Query `email_send_log` for `template_name='daily-reminder'` in the last 5 min → expect 12 rows.
- After ~30 s (queue dispatch every 5 s), expect status `sent`.
- Query `email_preferences.last_sent_on` for the 12 users → expect today's local date populated.

### Cleanup

Delete `/tmp/backfill-daily.ts` after the run completes.
