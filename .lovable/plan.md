
# Dopamine Menu — Build Plan (revised)

A faithful React/TanStack Start build of the `dopamine-menu-v2.html` mockup wired to Lovable Cloud (Supabase) for auth, custom hits, and logged commits.

## 1. Backend (Lovable Cloud)

Enable Lovable Cloud, then create:

- **Google OAuth** as the sole sign-in method (via Lovable broker + `supabase--configure_social_auth` for `google`).
- **`custom_hits`** table: `id`, `user_id` (fk auth.users, NOT NULL), `name` text, `detail` text NULL, `category` enum `quick|medium|big`, `created_at` timestamptz. RLS: owner-only select / insert / **delete**.
- **`dopamine_logs`** table: `id`, `user_id` NOT NULL, `item_name` text, `category` enum, `is_custom` bool, `streak_at_time` int, `logged_at` timestamptz. RLS: owner-only select / insert / delete. Index `(user_id, logged_at)`.
- Seeded menu lives in `src/data/seedMenu.ts` (18 items, all `is_custom: false`) — see §5.

## 2. Design system

Port mockup tokens verbatim into `src/styles.css` as oklch (cream `#FFF4E0`, ink `#1A1A2E`, pink `#FF2E63`, yellow `#FFCB47`, teal `#08D9D6`) plus footer tokens from `studio-footer.md`. Load Bungee + DM Mono + DM Serif Display via Google Fonts. Diagonal pinstripe background on body. Map `--font-display`, `--font-serif`, `--font-body` for utility access.

## 3. Routes

```
src/routes/
  __root.tsx                  shell + QueryClient + auth listener + StudioFooter
  index.tsx                   signed-out landing → "Sign in with Google"; signed-in → redirect /menu
  _authenticated.tsx          guard (beforeLoad: supabase.auth.getUser; redirect to / if none)
  _authenticated/menu.tsx     main app
  _authenticated/account.tsx  account info, export CSV, sign out, delete account
  auth/callback.tsx           OAuth callback handler
```

Each route gets its own `head()` meta.

## 4. Components

- `Userbar` — brand mark, mini streak, avatar dropdown (→ /account, sign out)
- `Masthead` — kicker + "Dopamine" title with yellow drop shadow + italic subtitle
- `StreakSection` — big number + 7-day strip; today gets yellow ring, completed days fill pink
- `RollSection` + `RevealCard` — randomizer, reroll, "I did it ✓"
- `MenuSection` — three categories with dotted-leader items, teal "yours" badge for customs, hover `×` for delete
- `AddCustomForm` — inline form with **name** + **optional detail** inputs (see §6)
- `DeleteCustomDialog` — confirmation modal (see §6)
- `Confetti` — vanilla DOM emoji burst, fixed counts (see §7)
- `MilestoneOverlay` — full-screen card, auto-dismiss 2.8s, `pointer-events: none`
- `useChime` — Web Audio two-note normal / four-note major chord milestone
- `StudioFooter` — reusable, prop-driven (see §10)

## 5. Seed menu (`src/data/seedMenu.ts`)

All 18 items `is_custom: false`. Two mockup demo customs replaced:

- **Quick** (~2 min): Step outside look at the sky · Cold water on the face · Loud song full volume · 20 jumping jacks · Write one sentence by hand · Text someone you love
- **Medium** (~15 min): Walk around the block · Make a proper coffee · **Stretch session** ("Just five poses") · Sketch the room you're in · Tidy one small surface · Read one article fully
- **Big** (~1 hour): Cook something new · Go to the gym · Long walk + podcast · **Coffee with a friend** ("In person, no agenda") · Side project — fun part only · Hands-on hobby session

## 6. Custom hits

Add form has two inputs:
- **Name** (required, max 60 chars)
- **Detail** (optional, max 60 chars, placeholder `Optional detail (e.g. "Just five poses")`) — stored as `null` if empty

Submit → `custom_hits` insert with `user_id = auth.uid()`, optimistic prepend with teal `yours` badge. Detail does **not** render in the menu list — only surfaces on the reveal card when that item is rolled.

**Delete:** small `×` icon top-right of each custom item row, visible on hover. Click → confirmation modal: title "Delete this hit?", body "Past logs are kept." → on confirm: `delete from custom_hits where id = $1` (RLS scoped). `dopamine_logs` untouched (stores `item_name` as text snapshot).

No edit in v1 — delete-and-re-add covers the case.

## 7. Roll + commit flow

1. "Give Me One" picks uniformly across union(seed + user's custom items). Dice rotates 360°.
2. Reveal card bounces in. Detail line shows `${time} · ${item.detail ?? ''}` (skip ` · ` separator if no detail).
3. "Roll again" re-rolls. "I did it ✓":
   - Server fn (`requireSupabaseAuth`) inserts `dopamine_logs` row with computed `streak_at_time`.
   - Plays chime, fires confetti, recomputes streak query, fills today's dot, shows milestone overlay if streak ∈ {3,7,14,30,60,100}.

**Confetti piece counts (exact):**
- First commit of the day, non-milestone: **24**
- Subsequent same-day commits: **18**
- Milestone day: **80** + four-note chord chime

**Milestone overlay:** `setTimeout(() => setMilestone(null), 2800)` after show. `pointer-events: none` on the overlay container.

## 8. Streak logic

Computed client-side from `dopamine_logs` for the signed-in user (also computed server-side when generating `streak_at_time`):
- Group logs by user-local date.
- Walk back from today; consecutive days with ≥1 log = streak.
- Allow **one missed day per rolling 7-day window** (silent grace). **Never surfaced in UI.**
- Today's dot fills only on the first commit of the local day.

Cached in TanStack Query `['streak', userId]`; invalidated after each commit.

## 9. Account page

- Google email, name, avatar, member-since.
- **Export CSV** (server fn): `Logged At, Item, Category, Custom?, Streak at Time` — local-time `Logged At`, `Quick`/`Medium`/`Big`, `yes`/`no`. Filename `dopamine-menu-export-YYYY-MM-DD.csv`.
- **Sign out**.
- **Delete account**: typed `DELETE` confirmation, offers CSV export first, then admin server route hard-deletes `dopamine_logs` + `custom_hits` + auth user via `supabaseAdmin`.

## 10. Studio Footer (reusable)

`src/components/StudioFooter.tsx` props: `{ productName, tagline, icon, iconColorVar }`. Renders the structure from `studio-footer.md` with spacing 64/12/20/48/20/40 and `--footer-bg/text/text-soft/text-faint/rule` tokens defined per-product in `styles.css`. Lives in `__root.tsx`. For Dopamine Menu: icon `🎲`, color `--pink`, tagline "Healthy hits, on tap."

## 11. Confirmed defaults

- Roll-only commit (items not directly tappable).
- Grace day stays invisible.

## Technical notes

- Server functions in `src/lib/*.functions.ts`: `commitHit`, `addCustomHit`, `deleteCustomHit`, `getMyData` (logs + custom hits in one call), `exportCsv`, `deleteAccount`. All use `requireSupabaseAuth` except `deleteAccount` which uses `supabaseAdmin` after re-verifying the caller.
- `attachSupabaseAuth` registered in `src/start.ts` (`functionMiddleware`).
- All colors via semantic tokens; no raw hex in JSX.
- Confetti and chime are pure browser APIs (no library deps).
- Mobile breakpoint at 600px collapses the menu grid to one column.
