## Problem

`/admin/usage` redirects to `/menu` even for the admin user.

**Root cause:** The route's `beforeLoad` calls `getMyRoles()` (a server fn protected by `requireSupabaseAuth`). `beforeLoad` runs *before* the `_authenticated` layout component mounts and hydrates the Supabase session, so the request goes out without a bearer token → server returns 401 → the `catch` branch fires `redirect({ to: "/menu" })`. This happens to every user, admin or not.

## Fix

Move the admin gate from `beforeLoad` into the component, so it runs only after `_authenticated` has confirmed a session and `attachSupabaseAuth` can attach the user's token.

### Changes to `src/routes/_authenticated/admin/usage.tsx`

1. Remove the `beforeLoad` block entirely.
2. In `AdminUsagePage`, use the existing `useIsAdmin()` hook:
   - While loading → render a small "Checking access…" state.
   - If not admin → render a "Not authorized" message with a link back to `/menu` (no redirect — avoids any loop and makes the failure visible).
   - If admin → render the dashboard as today.
3. Keep `getUsageStats` query gated on `isAdmin === true` via `enabled` so non-admins don't fire the stats request.

### Out of scope

- No DB or server-fn changes. The admin role row for `brian@krianbalma.com` is already in `user_roles`.
- No changes to `_authenticated.tsx`, `useIsAdmin`, or `roles.functions.ts`.

### Verification

After the change: signed-in admin visiting `/admin/usage` sees the dashboard; signed-in non-admin sees "Not authorized"; signed-out user is bounced to `/` by the `_authenticated` layout as before.
