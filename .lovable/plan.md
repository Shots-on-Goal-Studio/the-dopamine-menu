## Repair: Safari new-user `/welcome` blank until refresh

### What's happening on Safari

When a new user finishes Google OAuth and lands on `/welcome` for the first time, Safari shows a blank screen until they refresh. After the refresh, it renders fine. Three Safari-specific behaviors combine to cause this:

1. **`/welcome` is gated by `_authenticated.tsx`.** Until that gate flips to `"ok"`, it renders `<AuthLoading>` (cream "Warming up the menu…" — visually faint, easy to misread as blank). Safari's storage layer often takes 1–3s longer than Chrome to surface the just-written Supabase session to `getSession()` after an OAuth redirect, and `onAuthStateChange` does not always fire a fresh event on the next route mount when the session is already live (Safari ITP + the new `_authenticated` mount means we subscribe AFTER `INITIAL_SESSION` has already passed). The page just sits on `AuthLoading` until something nudges it — a refresh does.

2. **My previous repair bumped the gate timeout from 2.5s → 8s.** That made the "blank" window noticeably longer on Safari, because Safari is exactly the browser that hits the slow path.

3. **`/welcome` doesn't actually need a server session to render.** It's a purely informational onboarding screen — its only auth-dependent action (fetching email prefs) is already deferred to the "Enable browser nudges" click. Gating its render behind `_authenticated` was over-cautious.

The runtime error "Uncaught undefined" likely comes from the dynamic `import("@/lib/browserNotifications")` rejecting without a value on Safari's first paint, but it is a symptom of the same blocked-render path, not the cause.

### Fix plan

**1. Move `/welcome` out of the auth gate.**

- Rename `src/routes/_authenticated/welcome.tsx` → `src/routes/welcome.tsx`. Update the `createFileRoute` path from `"/_authenticated/welcome"` to `"/welcome"`.
- Result: the welcome UI renders on first paint, with no auth-readiness wait. This eliminates the Safari blank-screen window entirely.

**2. Add a soft session check inside `welcome.tsx`.**

- On mount, subscribe to `supabase.auth.onAuthStateChange` AND call `supabase.auth.getSession()` (mirroring the AuthGate pattern, but non-blocking for render).
- If, after a 10s grace, we still have no session AND no `SIGNED_IN` event, navigate to `/`. Otherwise, just continue — the welcome page works without server data.
- This preserves the "don't show /welcome to a fully signed-out stranger" guard without ever blocking first paint.

**3. Harden the dynamic import that's throwing "Uncaught undefined".**

- In `welcome.tsx`'s mount effect, wrap the `import("@/lib/browserNotifications")` and the subsequent `getPermission()` call in `try/catch` that coerces non-Error rejections (`catch (e) { console.warn("notif probe failed", e); setPerm("unsupported"); }`). This already exists for `enableNudges`; mirror it on the probe call.
- Defensively check `typeof Notification !== "undefined"` before calling `getPermission()` — Safari on iOS does not expose the Notification constructor at all, and the helper currently assumes it does.

**4. Revert the auth-gate timeout to a sane value.**

- In `src/routes/_authenticated.tsx`, drop the timeout from 8s back to 4s. With `/welcome` no longer behind the gate, the gate only runs for routes that genuinely need auth (`/menu`, `/account`, `/admin`), where waiting 4s is reasonable and a redirect to `/` is the correct fallback.
- Keep the single `getSession()` retry inside the timeout — that's still the right defense for genuinely auth-gated routes.

**5. Update the root listener to match the new route location.**

- In `src/routes/__root.tsx` `AuthListener`, the existing `SIGNED_IN` → `/welcome` redirect already works (path is unchanged from the URL perspective). No code change needed there, but verify after moving the file.

**6. Verify in Safari preview.**

- Open the preview in Safari (or Safari Technology Preview), sign in fresh with Google, and confirm `/welcome` paints headline + buttons immediately without a refresh. Confirm "Enable browser nudges" still works (or gracefully shows the unsupported state on iOS Safari). Confirm `/menu` still auth-gates correctly after.

### Files touched

- `src/routes/_authenticated/welcome.tsx` — **delete** (moved).
- `src/routes/welcome.tsx` — **new**, contains the moved welcome screen with a non-blocking soft session check and hardened Notification probe.
- `src/routes/_authenticated.tsx` — revert timeout 8s → 4s.
- `src/routes/__root.tsx` — verify the SIGNED_IN redirect still targets `/welcome` (no functional change expected).

### Out of scope

- No DB / server-fn / email / cron changes.
- No design changes — visual screen is identical to today.
- Not changing the `dm.onboarded` flag mechanism.
- Not addressing the broader Safari ITP/localStorage timing for other routes — `/menu` and friends still legitimately need the auth gate, and 4s + a single retry is the appropriate posture there.
