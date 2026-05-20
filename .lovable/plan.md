## Goal

Add "Pop a Balloon" — the first `tap` menu item. Tapping it opens an in-app balloon-popping interaction at `/popper/balloon` instead of pointing at an IRL action. Commit on Done with full parity to the menu's success handler. Refresh-safe.

## 1. Seed data (`src/data/seedMenu.ts`)

Extend `SeedItem` with an optional `kind`:

```ts
export type ItemKind = "standard" | "tap";
export type SeedItem = {
  name: string;
  detail: string;
  category: Category;
  kind?: ItemKind; // omitted = "standard"
};
```

Add one seed in the `quick` section:

```ts
{ name: "Pop a Balloon", detail: "Tap to pop. 30 seconds.", category: "quick", kind: "tap" }
```

Everything else (helpers, labels, ordering) stays. `'standard'` is inferred when `kind` is missing.

## 2. Menu route (`src/routes/_authenticated/menu.tsx`)

Purely presentational changes:

- `ItemRow` gains an optional `kind?: "standard" | "tap"` prop. When `"tap"`, render a second pill next to the name (or replacing `yours` for seed taps) that matches the `yours` pill exactly except color — use `var(--pink)` background with `var(--cream)` text and label `TAP`.
- `Section` passes `kind={s.kind ?? "standard"}` for seed items. Custom hits stay standard.
- `handlePick` reads `kind` for seed items. If `kind === "tap"`, **navigate** to `/popper/${slug}` (for v1: `/popper/balloon`) using TanStack `useNavigate` and return early — do NOT open the reveal card.
- `RevealCard` is untouched for standard items. (No reveal swap needed since taps skip the reveal entirely and go straight to the interaction.)

Slug derivation: hard-code `/popper/balloon` for the Pop a Balloon seed. No registry needed for one item; we'll generalize if a second tap ships.

## 3. New route (`src/routes/_authenticated/popper/balloon.tsx`)

Standalone page under the `_authenticated` layout, so unauthenticated users redirect to `/login`.

### Layout (matches site visual system)

- `Userbar` (extracted/shared — see "Refactor note" below) at top showing streak and avatar.
- Centered stage with the balloon.
- Lifetime counter beneath: "Balloons popped (all time): N".
- Back link to `/menu`.

### Interaction

- Balloon = inflating SVG/div circle. Each tap pops it with a satisfying micro-burst (small confetti, balloon-pop sound via `playChime`-style WebAudio, screen shake optional). On pop, increment a session counter and immediately respawn a new balloon at a slightly different position/size/color (pulled from `--pink`, `--yellow`, `--teal`).
- Bottom action row: `[ Done ]` (yellow/ink CTA matching reveal card style) and `[ Back ]` (outlined). No time limit; user decides when done. Detail copy "30 seconds" is just guidance — no enforced timer.

### Done handler

On click of Done, call `commitFn` with:
```ts
{ itemName: "Pop a Balloon", category: "quick", isCustom: false, timeZone: tz }
```
then run the **full menu.tsx `handleCommitSuccess`** logic (minus `setRevealed(null)`):
- `qc.invalidateQueries({ queryKey: ["dopamine", "data"] })`
- `playChime(MILESTONES.has(newStreak))`
- If milestone: `burstConfetti(80)`, show `MilestoneOverlay` for 2800ms
- Else: `burstConfetti(wasFirstToday ? 24 : 18)`
- Then `navigate({ to: "/menu" })` after a short delay so the overlay/confetti are seen

`wasFirstToday` is derived from `getMyData` (same logic as menu.tsx).

### Lifetime counter

New server fn `getBalloonPopsTotal` in a new file `src/lib/popper.functions.ts`:
- Counts `dopamine_logs` where `user_id = auth.uid()` AND `item_name = 'Pop a Balloon'`. Returns `{ total: number }`.
- Note: this is the count of **commits** (Done presses), not raw pops. That's what "Balloons popped (all time)" represents — same semantic as a streak-counted hit. (Calling out the choice; alternative would be tracking raw taps via `app_events`, which is out of scope for v1.)

Wired via `useQuery({ queryKey: ["popper", "balloon", "total"] })`. Invalidate on commit success.

### Refresh-safe fallbacks

When the route is hit directly (cold load, queries pending):
- Userbar streak: render `—` while `getMyData` is loading or `streak` is undefined; render the number once resolved.
- Lifetime counter: render `—` while `getBalloonPopsTotal` is loading; render `total.toLocaleString()` once resolved.

No layout shift — same width via fixed min-width or `tabular-nums`.

## 4. Refactor note: shared `Userbar`

`Userbar` currently lives inside `menu.tsx`. Extract to `src/components/Userbar.tsx` and import from both `menu.tsx` and the new popper route. Same component, accepts `streak: number | undefined` now (renders `—` when undefined) so the popper can pass a possibly-loading value without breaking the menu's existing behavior (menu passes its already-resolved `streak`).

## 5. Analytics

- `track("menu_item_clicked", { name: "Pop a Balloon", category: "quick", is_custom: false })` still fires from `handlePick` before the navigate.
- On Done success: `track("menu_item_logged", { name: "Pop a Balloon", category: "quick", is_custom: false })` — same shape as menu commits, fires before `commitFn`.
- Optional: `track("balloon_popped")` per tap (omit unless requested — keeps event volume sane).

## 6. Files touched

- `src/data/seedMenu.ts` — extend type, add seed
- `src/routes/_authenticated/menu.tsx` — TAP pill + tap-kind navigation in `handlePick`
- `src/routes/_authenticated/popper/balloon.tsx` — new
- `src/lib/popper.functions.ts` — new (`getBalloonPopsTotal`)
- `src/components/Userbar.tsx` — extracted shared component
- (No DB migration — reuses `dopamine_logs`. No new event types.)

## Out of scope

- A `tap` registry / generic `/popper/:slug` route — punted until a second tap ships.
- Raw-tap analytics events.
- Enforced 30-second timer.
- Reveal-card variant for tap items (taps skip the reveal entirely).
