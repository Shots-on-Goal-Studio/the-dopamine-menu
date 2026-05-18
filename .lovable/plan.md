Yes, `/account` being blank confirms this is a shared protected-route/auth-hydration issue, plus one page-level blank state.

What changes in my POV:
- The common `_authenticated` wrapper is likely deciding there is no session before Lovable Cloud auth has fully restored it, then redirecting users away from both `/menu` and `/account`.
- `/account` also has its own `if (!user) return null`, so even if the protected wrapper succeeds, a slow or failed `getUser()` call leaves that page blank.
- The fix should be centralized, then make `/account` resilient.

Plan:
1. Update `_authenticated.tsx` so it uses `onAuthStateChange` first, then calls `getSession()`, and waits for the initial auth event before deciding. This follows the auth implementation guidance and avoids premature redirects.
2. Replace `return null` during auth checks with a small branded loading state, so the app never appears blank while restoring a session.
3. Update `/` to use the same safe session-hydration pattern before redirecting signed-in users to `/menu` or showing the Google sign-in page.
4. Update `/account` so it does not render blank while loading user/profile/email preferences. It should show a loading state, and if user lookup fails or no user exists, redirect/sign out cleanly instead of staying empty.
5. Keep server function calls behind the authenticated wrapper; if a protected server function returns unauthorized, show a toast/sign-in fallback rather than a blank screen.
6. Move or guard the welcome-email side effect in `__root.tsx` so auth-state route invalidation remains fast and email sending cannot interfere with navigation.
7. Verify `/menu` and `/account` direct loads: signed-out users see sign-in, signed-in users stay on the requested page, and stale sessions recover to sign-in without a blank page.