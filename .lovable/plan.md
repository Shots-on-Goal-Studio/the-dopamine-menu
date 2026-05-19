## Confirmation: daily reminders are broken for ALL users

**No daily reminder has ever been delivered.** `email_send_log` contains 0 rows for `template_name = 'daily-reminder'`. All 17 opted-in users are affected (every user with `daily_reminder = true`).

### Evidence

The pg_cron job `daily-dopamine-reminders` fires every 15 minutes and successfully hits `/api/public/cron/daily-reminders`. Looking at today's `net._http_response`:

- **09:00–09:45 UTC** (UTC-timezone users' 9 AM window): route reports `due: 5, sent: 0, failed: 5` every run.
- **13:00 UTC** (America/New_York 9 AM window, 5 users): pg_net **timed out at 5 s** — the route was still running.
- Every other run returns `due: 0` (nobody's local hour was 9).
- `last_sent_on` is `NULL` for all 17 users, so the same users keep being "due" and keep failing on the next run.

### Root cause #1 — auth mismatch (causes every send to fail)

`src/routes/api/public/cron/daily-reminders.ts` calls the transactional sender like this:

```ts
fetch('/lovable/email/transactional/send', {
  headers: { Authorization: `Bearer ${serviceKey}` },
  ...
})
```

But `src/routes/lovable/email/transactional/send.ts` validates the bearer with `supabase.auth.getUser(token)`, which only accepts **end-user access tokens**, not the service-role JWT. Every call returns **401 Unauthorized**, so:
- The send route exits before reaching the `email_send_log` insert (that's why there are zero log rows).
- The cron loop counts each as `failed++` and never updates `last_sent_on` → infinite retry every 15 min.

### Root cause #2 — 5 s pg_net timeout (compounds the problem at 9 AM ET)

The cron route processes users **serially** with multiple awaits per user (admin lookup → custom_hits → fetch send route → update). For the 9 NY users due at 13:00 UTC, this blew past pg_net's default 5 s timeout. Even with the auth fix, this batch would time out.

---

## Plan

### 1. Skip the HTTP hop — enqueue emails directly from the cron route

Refactor `src/routes/api/public/cron/daily-reminders.ts` so that, instead of POSTing to `/lovable/email/transactional/send`, it does the same work that route does, inline with the service-role client it already holds:

- Look up `suppressed_emails` (skip if suppressed).
- Get-or-create the `email_unsubscribe_tokens` row.
- Render the `daily-reminder` React Email template (`TEMPLATES['daily-reminder']`) to HTML + text.
- Insert a `pending` row into `email_send_log`.
- Call `supabase.rpc('enqueue_email', { queue_name: 'transactional_emails', payload: { ... from, sender_domain, subject, html, text, idempotency_key: 'daily-<user_id>-<localDate>', unsubscribe_token, ... } })`.
- On success, update `last_sent_on = localDate`.

This fixes both bugs at once: no more 401 (no auth hop), and the per-user work is just two DB round-trips, so the 5 s pg_net budget is comfortable even for 9 concurrent NY users.

`SITE_NAME`, `SENDER_DOMAIN`, and `FROM_DOMAIN` are copied from the send route so the "From" header stays `Dopamine Menu <noreply@dopamine.shotsongoal.studio>`.

### 2. Backfill today's missed reminders (optional, one-off)

Today's already-passed 9 AM windows that were lost:
- **5 UTC users** (9 AM UTC passed at 09:00).
- **5 America/New_York users** (9 AM ET passed at 13:00 UTC).
- **1 Europe/Helsinki, 1 Europe/Vilnius** (also already past).

Chicago (14:00 UTC) and LA (16:00 UTC) haven't happened yet today and will be picked up by the fixed cron on the next 15-min tick after the fix ships.

Ask: **do you want me to backfill the ~12 users whose 9 AM window already passed today?** If yes, I'll run a one-off script after the fix is deployed.

### 3. Verify after deploy

- Check `email_send_log` for `template_name = 'daily-reminder'` and `status IN ('pending','sent')`.
- Confirm `email_preferences.last_sent_on = today` for users processed.
- Spot-check `net._http_response` for the cron — should report `sent: N, failed: 0` and no timeouts.

### Technical notes

- The fix reuses the existing pgmq queue + `process-email-queue` dispatcher; no new infra.
- Idempotency key `daily-<user_id>-<localDate>` prevents duplicate sends if the cron retries within the same local day.
- The send-route's `getUser(token)` auth is correct for browser callers and stays as-is — we just stop misusing it from the cron.
