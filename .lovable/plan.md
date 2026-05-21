# Plan: Email auth as a secondary option

## Goal
Keep Google as the primary, one-tap sign-in. Add email + password as a clearly secondary path for users who don't want Google, without cluttering the landing hero.

## UX

Landing page (`src/routes/index.tsx`) stays visually anchored on the big "Sign in with Google" button. Below it:

```text
        [ Sign in with Google ]      ← primary, unchanged

        — or —                        ← thin divider, muted

        Continue with email           ← small text link / ghost button
```

Clicking "Continue with email" expands an inline panel (no route change, no modal) with:
- Email field
- Password field
- Primary action button: **Sign in**
- Secondary text link: **No account? Create one** (toggles the same panel into sign-up mode)
- In sign-up mode the button becomes **Create account** and a "Already have an account? Sign in" link toggles back
- Inline error text under the form on failure (wrong password, email taken, weak password, etc.)
- "Forgot password?" link (sign-in mode only) → opens a small inline "enter your email" prompt that calls `resetPasswordForEmail`

Keeping it inline (not a separate `/login` route) preserves the landing's tone and avoids a second page that competes with the Google button.

## New route: `/reset-password`
Required by Supabase's recovery flow. Public route. Detects `type=recovery` in the URL hash, shows a "Set new password" form, calls `supabase.auth.updateUser({ password })`, then redirects to `/menu`. Styled to match the landing (ink/yellow/pink tokens, display font).

## Auth behavior
- **Email confirmation: ON** (Supabase default). After sign-up, show a "Check your inbox to confirm your email" state in the inline panel. Do not auto-sign-in. This matches the platform rule against auto-confirm.
- `signUp` call uses `emailRedirectTo: window.location.origin` so the confirmation link lands back on the site and the existing `AuthListener` picks up `SIGNED_IN`.
- `resetPasswordForEmail` uses `redirectTo: window.location.origin + '/reset-password'`.
- HIBP leaked-password check enabled via `configure_auth` so weak/breached passwords are rejected at sign-up and password reset.
- Email provider stays enabled in Supabase Auth (it already is, since this is a fresh add). Google stays enabled. No provider is disabled.

## Auth emails
Supabase will send the confirmation + password-reset emails. The project already has a verified email domain and templates set up for transactional mail, but **Supabase Auth emails are a separate templating system**. Two options:

- **A. Use Supabase's default auth emails** — works immediately, generic styling, sent from Supabase's shared domain. Zero extra setup.
- **B. Scaffold branded auth email templates** on the project's domain (signup confirmation, password reset, magic link, etc.) so the confirm/reset emails match the Dopamine Menu brand.

Recommend B since the domain is already verified — it's a one-step scaffold and the emails will feel consistent with the welcome email. Open question below.

## Welcome email interaction
The existing `AuthListener` fires the welcome email on first `SIGNED_IN`. That keeps working for email users — the welcome only sends after they confirm and actually sign in for the first time. No change needed.

## Files to touch

- `src/routes/index.tsx` — add the collapsible email panel under the Google button. New small component `EmailAuthPanel` either inline or in `src/components/EmailAuthPanel.tsx` (lean toward a separate component to keep the route file readable).
- `src/routes/reset-password.tsx` — new public route with the set-new-password form.
- Call `supabase--configure_auth` to enable `password_hibp_enabled: true` (leave `auto_confirm_email: false`, `disable_signup: false`, `external_anonymous_users_enabled: false`).
- Optionally call `email_domain--scaffold_auth_email_templates` if user picks Option B.

## Out of scope
- Magic links (can be added later as a third option if requested)
- Phone / SMS auth
- Social providers beyond Google
- Account-linking flow if a user signs up with email using an address that already has a Google account (Supabase will surface a clear error; we'll display it; no merging logic this round)

## Open questions

1. **Auth email branding** — go with Option B (scaffold branded auth email templates on your domain) or stick with Option A (Supabase defaults)?
2. **Sign-up copy** — anything specific you want on the "check your inbox" confirmation state, or default to "Check **email@address** to confirm your account"?
