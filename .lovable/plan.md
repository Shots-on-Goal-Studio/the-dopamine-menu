## Plan — Daily reminder + welcome emails

### 1. Database

Add `email_preferences` table (one row per user):
- `user_id` (PK, references auth.users)
- `daily_reminder` boolean default `true`
- `timezone` text default `'UTC'`
- `last_sent_on` date (so we don't double-send within a day)
- `created_at`, `updated_at`

RLS: user can select/update their own row. Service role has full access.

Trigger `on_auth_user_created` → inserts a default `email_preferences` row whenever a new user is added to `auth.users`.

### 2. Email infrastructure

Scaffold transactional email templates (creates the send route, suppression handling, unsubscribe page, and template registry).

### 3. Two branded React Email templates

Both styled to match the site — cream background, ink text, Bungee display headings, DM Serif body, pink/yellow/teal accents, chunky borders.

**`welcome.tsx`** — Sent right after signup.
- Big "Welcome to the Dopamine Menu" headline
- Short blurb explaining the purpose (a curated menu of small joys, log them to build a streak)
- Note: "We'll send one short reminder each morning with a random hit from your menu. You can turn it off any time in Account."
- CTA button → `/menu`

**`daily-reminder.tsx`** — One random pick.
- Headline: "Today's pick from your menu"
- Card showing item name, time-cost label, category color
- Sub-line if it's a custom hit ("From your custom hits")
- CTA button → `/menu` (with optional `?hit=<id>` for future deep-link)
- Small footer line: "Don't want these? Turn off daily reminders in Account."

Templates accept `templateData` props for `name`, `itemName`, `category`, `detail`, `isCustom`.

### 4. Account UI

Add a new section between "Account info" and "Export" in `/account`:
- Toggle: **Daily reminder email** (on/off)
- Helper text: "We'll email you one random idea from your menu each morning around 8 AM your time."
- Saves on change via a new server fn `setEmailPreferences({ dailyReminder })` which also captures the browser timezone.

### 5. Welcome email trigger

After a successful sign-up (`src/routes/index.tsx` sign-up flow), call the helper `sendTransactionalEmail({ templateName: 'welcome', recipientEmail, idempotencyKey: 'welcome-<userId>' })`. Idempotency key prevents duplicates across retries.

### 6. Daily reminder cron

Public server route `/api/public/cron/daily-reminders` (auth via `apikey` header = anon key, validated against `SUPABASE_PUBLISHABLE_KEY`):
1. Reads `email_preferences` where `daily_reminder = true` AND `last_sent_on IS NULL OR last_sent_on < today_in_user_tz`.
2. For each user where local time is currently between 8:00–9:00 AM:
   - Pull their custom hits + the seed menu items
   - Pick one at random
   - Look up the user's email via `supabaseAdmin.auth.admin.getUserById`
   - Enqueue via the existing `send-transactional-email` route (server-to-server with service role)
   - Update `last_sent_on`

Schedule via `pg_cron` to run every 15 minutes — that's granular enough to catch each user's local 8 AM window without spamming.

### Technical notes

- All email sends go through the existing pgmq queue (created earlier) — automatic retries, rate-limit handling, suppression checks.
- Random pick uses `Math.random()` over `[...SEED_MENU, ...customHits]`.
- Timezone is captured client-side from `Intl.DateTimeFormat().resolvedOptions().timeZone` on the account page and when the welcome email is sent.
- The unsubscribe footer Lovable auto-appends covers compliance; the in-app Account toggle is the primary opt-out path.
- DNS for `notify.dopamine.shotsongoal.studio` must finish verifying before emails actually leave — we'll set up everything now and they'll start flowing automatically once DNS is green.
