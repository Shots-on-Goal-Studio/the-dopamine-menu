## Problem

Returning signed-in users land on a blank page at `/` (and when hitting `/menu` directly). Server logs confirm the flow:

```
GET /menu → 307     (server redirects to /)
GET /     → 200     (renders blank HTML)
...nothing further...
```

## Root cause

Supabase auth lives in browser `localStorage`, not in cookies. That breaks our routing in two places:

1. **`src/routes/_authenticated.tsx`** runs `supabase.auth.getUser()` in `beforeLoad`. During SSR there is no session, so it always redirects authenticated users away from `/menu` to `/`.
2. **`src/routes/index.tsx`** (`Landing`) renders `null` while `checking === true`. On the client it calls `supabase.auth.getUser()` (which hits the auth network endpoint and validates the JWT). There is no `.catch`, so any network/JWT error leaves `checking` stuck at `true` → permanently blank page. Even on the happy path, this introduces an unnecessary blank flash on every visit.

The net effect: any direct visit to `/menu` (including from the welcome email link → `/`) ends up on a Landing page whose auth probe can silently fail or stall, leaving the page blank.

## Fix

1. **`src/routes/_authenticated.tsx`** — Do not run the auth redirect during SSR. Skip `beforeLoad` server-side (or guard with `typeof window === 'undefined'` → return). Move the gate into the component: read `supabase.auth.getSession()` (synchronous localStorage read, no network), render `<Outlet />` if a session exists, otherwise `navigate({ to: '/' })`. While the session is being determined on first paint, render `null` or a tiny placeholder.

2. **`src/routes/index.tsx`** — Replace `supabase.auth.getUser()` with `supabase.auth.getSession()` (no network round-trip, no JWT validation hang). Add `.catch(() => setChecking(false))` as a safety net so the page can never get stuck blank. Behavior unchanged: if session present, `navigate({ to: '/menu' })`; otherwise show the sign-in screen.

3. **No DB / no email / no template changes.** This is purely a routing/auth-bootstrap fix.

## Verification

After deploying, in an authenticated browser:
- Visit `/menu` directly → page renders the menu (no 307 to `/`).
- Visit `/` directly → briefly nothing, then redirects to `/menu`.
- Welcome-email link (which lands on `/`) → redirects to `/menu`.
- In a signed-out browser, `/menu` → redirects to `/` and shows the sign-in screen.
- Check published worker logs: `/menu` should return `200`, not `307`, for signed-in users.
