## Admin usage dashboard + event tracking

Build a private `/admin/usage` page showing daily active users and engagement, plus instrument the menu page to track "Roll" clicks and individual menu item interactions.

### 1. Database changes

**`user_roles` table** (separate from profiles, per security best practice — never store roles on a user-data table)
- `app_role` enum: `'admin'`
- `user_roles(id, user_id, role, created_at)` with `UNIQUE(user_id, role)`
- RLS: users can read their own roles
- `has_role(_user_id, _role)` SECURITY DEFINER function to avoid recursive RLS

**`app_events` table** (lightweight event log)
- Columns: `id, user_id (nullable), event_type, metadata jsonb, occurred_at`
- `event_type` enum: `'roll_clicked'`, `'menu_item_clicked'`, `'menu_item_logged'`
- `metadata` stores `{ category, item_name, is_custom }` for menu events
- Index on `(event_type, occurred_at)` and `(occurred_at)` for fast daily rollups
- RLS:
  - Users can INSERT their own events (`auth.uid() = user_id`)
  - Only admins can SELECT (`has_role(auth.uid(), 'admin')`)
- Note: `dopamine_logs` already tracks check-offs, so this table is purely for *intent* events (rolls + clicks that don't necessarily complete).

### 2. Event tracking (client + server)

- New server fn `trackEvent({ eventType, metadata })` in `src/lib/analytics.functions.ts` — uses `requireSupabaseAuth`, inserts into `app_events`.
- Helper `track(eventType, metadata?)` in `src/lib/analytics.ts` — fire-and-forget wrapper, never blocks UI.
- Instrument `src/routes/_authenticated/menu.tsx`:
  - **Roll button** (`Give Me One` / re-roll) → `track('roll_clicked')`
  - **Menu item click** (when user taps a hit card to view/log) → `track('menu_item_clicked', { category, item_name, is_custom })`
  - **Hit completion** → `track('menu_item_logged', { category, item_name, is_custom })` (in addition to existing `dopamine_logs` insert, for unified analytics)

### 3. Admin page `/admin/usage`

Route gated by `has_role(auth.uid(), 'admin')` — non-admins get redirected to `/menu`. Server fn `getUsageStats({ range })` returns aggregated data using `supabaseAdmin` (after verifying the caller is admin).

**Layout** (matches existing brutalist Dopamine Menu style — cream bg, dark borders, Bungee headings):

- **Top filter bar**: range toggle `7d / 30d / 90d`, timezone toggle `UTC / Local (user's tz)`
- **KPI row** (4 cards): Total users · DAU today · WAU (7d) · Total hits logged in range
- **Daily activity chart** (Recharts bar chart): per day, stacked bars showing
  - Distinct active users (logged ≥1 hit) — from `dopamine_logs`
  - Distinct rollers (clicked roll, with or without logging) — from `app_events`
- **Engagement funnel** (small section): Rolls → Item clicks → Hits logged, with conversion %
- **Top menu items table**: most-logged items in range (name, category, count, custom vs seed)
- **Category breakdown**: pie/donut showing quick/medium/big distribution

### 4. Bootstrap admin role

Migration grants `admin` role to `brian@shotsongoal.io` by looking up the user_id in `auth.users` (server-side, no client exposure). If that's not the right email, you tell me and I'll adjust.

### 5. Navigation

Add a subtle "Admin" link in the account dropdown/footer, **only rendered when `has_role` returns true** for the current user. Never expose the route otherwise.

### Files to create / edit

**Create:**
- `src/lib/analytics.ts` (client helper)
- `src/lib/analytics.functions.ts` (`trackEvent`, `getUsageStats`)
- `src/routes/_authenticated/admin/usage.tsx` (admin page)
- `src/hooks/useIsAdmin.ts` (small hook calling a `getMyRoles` server fn)
- `src/lib/roles.functions.ts` (`getMyRoles`)

**Edit:**
- `src/routes/_authenticated/menu.tsx` (add `track()` calls at roll, click, log)
- `src/routes/_authenticated/account.tsx` (conditional admin link)

### Out of scope (ask later)
- Backfilling `app_events` from historical `dopamine_logs` (no need — `dopamine_logs` already covers historical DAU)
- Per-user drill-down view
- Email/notification on usage anomalies
- CSV export (easy to add later if you want)
