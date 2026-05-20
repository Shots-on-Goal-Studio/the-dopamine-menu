## Goal

1. Admin chart: visits to `/menu` bucketed by hour for the last 100 hours.
2. Admin table: every user's email + the last time they visited the site.

## Approach

We don't currently log page visits — `app_events` only has `roll_clicked`, `menu_item_clicked`, `menu_item_logged`. We'll add a new event type and fire it when the menu page mounts.

### 1. Track visits

- Migration: extend the `app_event_type` enum with `menu_visited`.
- In `src/routes/_authenticated/menu.tsx`, on mount (once per mount), call `trackEvent({ eventType: "menu_visited" })`. No metadata needed.
- `analytics.functions.ts` already accepts arbitrary enum values via the Zod schema — extend `eventTypeSchema` to include `menu_visited`.

### 2. Hourly visits chart (last 100 hours)

- New server fn `getHourlyVisits` in `analytics.functions.ts` (admin-gated like `getUsageStats`):
  - Reads `app_events` where `event_type = 'menu_visited'` and `occurred_at >= now() - 100 hours`.
  - Buckets in UTC by hour: returns `[{ hour: "2026-05-20T14:00:00Z", visits: number, uniqueUsers: number }, ...]`, zero-filled for empty hours so the chart isn't gappy.
- In `src/routes/_authenticated/admin/usage.tsx`, add a new `Card` titled "Menu visits (last 100h)" with a Recharts `BarChart` (or `LineChart`) showing `visits` per hour. X-axis ticks every ~6h to stay readable.

### 3. Per-user last visit table

- New server fn `getUsersLastVisit` in `analytics.functions.ts` (admin-gated):
  - Uses `supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })` to get `{ id, email, last_sign_in_at }`.
  - Queries `app_events` for `event_type = 'menu_visited'` grouped by `user_id` → max(`occurred_at`). Since Supabase JS can't do GROUP BY directly, either:
    - Pull recent events (say last 90 days, cap 50k) and reduce in JS to a `Map<user_id, lastVisit>`, OR
    - Add a small SQL view/RPC `user_last_visit` returning `(user_id, last_visited_at)` and call it.
    We'll go with the in-memory reduce — same pattern already used in `getUsageStats`, no new SQL surface.
  - Returns `[{ email, lastVisit: string | null, lastSignIn: string | null }, ...]` sorted by `lastVisit desc nulls last`.
- In `admin/usage.tsx`, add a new `Card` "Users — last visit" with a simple table: Email · Last visit · Last sign-in. Format times as relative ("2h ago") with absolute on hover.

## Files to touch

- Migration (enum extension only).
- `src/lib/analytics.functions.ts` — extend enum, add `getHourlyVisits` and `getUsersLastVisit`.
- `src/routes/_authenticated/menu.tsx` — fire `menu_visited` on mount.
- `src/routes/_authenticated/admin/usage.tsx` — add chart card + users table card.

## Out of scope

- Tracking visits to routes other than `/menu` (user only asked about `/menu`).
- Backfilling historical visits (impossible — we only have data going forward).
- Pagination on the users table beyond the 1000-user listUsers page (fine for current scale; can add later).
