## Repair: blank /welcome screen for new users

### What's happening

For a brand-new user, `/welcome` paints nothing. Two root causes are plausible and both should be fixed together:

1. **Auth-gate race.** `/welcome` lives under `src/routes/_authenticated.tsx`, which shows `AuthLoading` while it waits for a session. Right after the Google OAuth callback, the session sometimes isn't established before the gate's 2.5s safety timeout fires and flips status to `"out"` — kicking the user back to `/`. From the user's view, `/welcome` looks blank (spinner → empty as it navigates away). The browser runtime error `Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry` also points at client hydration failing on this route, which means the SSR'd `AuthLoading` shell never becomes interactive and the user just sees whitespace.

2. **First-paint depends on server-fn module loads.** `welcome.tsx` calls `useServerFn(getEmailPreferences)` and also pulls in `@/lib/browserNotifications` at module scope. If any of those dynamic chunks fail to load (which is what the runtime error is reporting), the route component itself fails to mount and renders nothing.

### Fix plan

**1. Make the welcome page resilient to a missing/late session.**

- In `src/routes/_authenticated/welcome.tsx`:
  - Render the static welcome content (headline, copy, daily-email card, Skip / Take me to menu buttons) **immediately and unconditionally**. Do not block the screen on any server fn or on Notification API access.
  - Move the `getEmailPreferences` call out of first render. Only call it lazily, **inside** `enableNudges()` (after the user clicks "Enable browser nudges"). If it throws, fall back to `{ reminder_hour: 9, extra_reminder_hours: [], timezone: tz }` and still schedule. This removes the server-fn module from the render-critical path.
  - Wrap the dynamic `notifGetPermission()` call in `useEffect` with a `try/catch` so an unsupported browser can never throw during mount.
  - Both "Skip" and "Take me to my menu" stay one-click safe: set `dm.onboarded=1` and `navigate({ to: "/menu" })`, never awaiting anything.

**2. Stop the auth gate from kicking new users out mid-OAuth.**

- In `src/routes/_authenticated.tsx`:
  - Bump the safety timeout from 2.5s → 8s. OAuth round-trips on cold loads regularly exceed 2.5s.
  - When the timeout fires while still `"checking"`, do **one** explicit `await supabase.auth.getSession()` retry before flipping to `"out"`. Only redirect to `/` if that retry also returns no session.
  - Keep the existing `onAuthStateChange` listener as the primary path.

**3. Don't redirect to /welcome before the session is actually usable.**

- In `src/routes/__root.tsx` `AuthListener`:
  - Keep the existing `SIGNED_IN` → `/welcome` redirect, but guard it: only navigate if `session?.user?.id` is present AND the current path is exactly `/` (not `/menu`, not `/welcome`, not `/account`, not `/admin`). This avoids a redirect storm where root pushes `/welcome` while `index.tsx` is already navigating.
  - Wrap the dynamic `import("@/lib/emailPrefs.functions")` / `import("@/lib/email/send")` / `import("@/lib/browserNotifications")` blocks in `try/catch` (they already are — verify and keep). A failed chunk load here must never bubble to the router.

**4. Verify the runtime error clears.**

- After the edits, reload `/welcome` in the preview, confirm the headline + "Enable browser nudges" button render on first paint for a signed-in user, confirm Skip navigates to `/menu`, and confirm no "Failed to fetch dynamically imported module" appears in console.

### Files touched

- `src/routes/_authenticated/welcome.tsx` — remove server-fn dependency from first paint; defer prefs fetch to click handler; harden Notification access.
- `src/routes/_authenticated.tsx` — longer auth-ready timeout + one retry before redirect.
- `src/routes/__root.tsx` — tighter SIGNED_IN redirect guard; confirm dynamic-import error handling.

### Out of scope

- No DB changes, no server-fn signature changes, no email/cron changes, no design changes beyond what's already on `/welcome`.
- Not moving `/welcome` out of `_authenticated` — the auth gate is the right place to handle session readiness; we're just making it patient enough for OAuth-fresh users.
