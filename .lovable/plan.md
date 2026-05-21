## New-user onboarding (one screen, skippable)

Drop brand-new users into a single-screen onboarding right after they sign up. They can skip at any time. The screen focuses on enabling **Browser Notifications** for dopamine nudges and references the daily email they'll start receiving, with a link to Account for more nudges.

### Flow

1. New user signs in with Google (first session ever).
2. Detect "first sign-in" and route to `/welcome` instead of `/menu`.
3. On `/welcome`, the user can:
   - Tap **Enable browser nudges** → triggers permission prompt, flips on browser notifications using existing `setEnabled` + `scheduleTodayNotifications`.
   - Tap **Skip for now** or **Take me to my menu** to continue.
4. Either action marks onboarding complete and navigates to `/menu`.
5. Future logins skip `/welcome` entirely.

### How we detect "new user"

Use `localStorage` key `dm.onboarded` as the source of truth (per-browser, simple, no schema changes).

- In the existing `AuthListener` in `src/routes/__root.tsx`, on `SIGNED_IN`, if `localStorage.getItem("dm.onboarded") !== "1"` AND the user lands on `/` or `/menu`, redirect to `/welcome`.
- `/welcome` sets `dm.onboarded = "1"` when the user clicks either CTA (enable or skip).
- Also set it to `"1"` automatically for existing users who already have email prefs older than ~10 seconds — prevents showing the welcome screen to people who already use the app. (Server-fn check: if `email_preferences.created_at` is more than a minute old, treat as returning user and set the flag without redirecting.)

### Screen content (`/welcome`)

Single centered card matching the existing Dopamine Menu style (cream bg, 3px ink border, display font headlines, yellow text-shadow):

- **Headline:** "Welcome to your Dopamine Menu 🎲"
- **Subhead (serif italic):** "Two quick things, then you're in."
- **Block 1 — Browser nudges (primary CTA):**
  - Title: "Turn on browser nudges"
  - Copy: "Get a gentle ping at your nudge times to pick a healthy hit. Works while this site or PWA is open."
  - Big button: **Enable browser nudges** (calls existing `requestPermission` + `setEnabled(true)` + `scheduleTodayNotifications` with the user's current prefs, default `reminder_hour=9`, no extras).
  - On grant: button flips to "Browser nudges on ✓" (teal, ink border).
  - On denied/unsupported: inline note explaining how to enable in browser settings; the rest of onboarding still works.
- **Block 2 — Daily email reference (informational, no toggle):**
  - Small card: "📬 You'll also get one short email each morning with a random pick. Manage timing or add extra nudges anytime in [Account]." (`Account` is a `<Link to="/account">`.)
- **Footer actions:**
  - Primary: **Take me to my menu →** (navigates to `/menu`)
  - Ghost: **Skip for now** (same destination, just different label intent — both mark onboarded)

### Technical details

**New file:** `src/routes/_authenticated/welcome.tsx`
- `createFileRoute("/_authenticated/welcome")` so it sits behind the existing auth gate.
- `head()` sets title "Welcome — Dopamine Menu".
- Imports from `@/lib/browserNotifications`: `isSupported`, `getPermission`, `requestPermission`, `setEnabled`, `scheduleTodayNotifications`.
- Imports `getEmailPreferences` from `@/lib/emailPrefs.functions` to read the user's current `reminder_hour` / `extra_reminder_hours` / `timezone` so scheduling matches their prefs (defaults are already set server-side on first read).
- On mount, fetch prefs once. On "Enable" click: request permission, if granted call `setEnabled(true)` + `scheduleTodayNotifications`, update local state. Toast on success/error using `sonner`.
- "Continue" / "Skip" handlers both: `localStorage.setItem("dm.onboarded", "1")` then `navigate({ to: "/menu" })`.
- Styling: reuse the toggle/button/card patterns from `account.tsx` (cream cards, 3px ink borders, display font, yellow/pink/teal accents). No new design tokens.

**Edited file:** `src/routes/__root.tsx`
- In the existing `onAuthStateChange` block, add a small redirect inside the `SIGNED_IN` branch:
  - If `localStorage.getItem("dm.onboarded") !== "1"` and current `window.location.pathname` is `/` or `/menu`, `router.navigate({ to: "/welcome" })`.
  - Skip if path already starts with `/welcome` or `/account` or `/admin`.
- The existing scheduling effect stays as-is — once the user enables in onboarding, it'll keep rescheduling on subsequent sign-ins.

**Edited file:** `src/routes/index.tsx`
- After session is found, instead of always navigating to `/menu`, check `localStorage.getItem("dm.onboarded")`. If missing, navigate to `/welcome`; else navigate to `/menu`. (This covers the case where the redirect from `__root` hasn't fired yet because the user opens `/` already signed in.)

**No DB changes, no server-fn changes, no email/cron changes.** The onboarding flag is local to the browser — acceptable since the consequence of re-seeing it on a new device is just one extra skippable screen.

### Out of scope

- Server-side persistence of the "onboarded" flag (could add an `email_preferences.onboarded_at` column later if needed).
- Multi-step onboarding (theme pick, sample menu, etc.).
- Changing email default behavior — daily reminder is already `true` by default in `email_preferences`.
- Push notifications (still local-only, per the existing browser-notifications implementation).
