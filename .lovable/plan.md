# Fix: No way to start popping from the Give Me One card

## Problem

When **Give Me One** rolls "Pop a Balloon", the `RevealCard` shows only:
- **Just Roll** (reroll)
- **I Did It ✓** (commits the log directly, never opens the popper)

There's no path from this card into `/popper/balloon`. The direct menu row works (it has the tap-kind handler in `handlePick` at menu.tsx:126-129), but the random-roll path bypasses it because `setRevealed(...)` is called unconditionally and `RevealCard` doesn't know about `kind`.

## Fix

Make the RevealCard tap-aware and route tap items to the popper instead of committing inline.

### 1. `RolledItem` carries kind

In `src/routes/_authenticated/menu.tsx`, extend the `RolledItem` type with `kind?: ItemKind`. Populate it in the two places `RolledItem`s are created:
- `rollPool` seed mapping (line 72) — pass through `s.kind`
- `handlePick` seed branch (line 124-130) — drop the early-return navigation; instead include `kind: s.kind` on the object passed to `setRevealed`. (Custom hits never have `kind`.)

This unifies behavior: both "click a row" and "roll random" land in `RevealCard` for tap items, so the experience is consistent.

### 2. RevealCard gains a tap variant

`RevealCard` (line 290) accepts a new optional `onPop?: () => void` prop. When the item's `kind === "tap"`:
- Replace the **I Did It ✓** button with **Pop It →** (same yellow style)
- Clicking calls `onPop` → `navigate({ to: "/popper/balloon" })`
- **Just Roll** stays unchanged
- Hide the commit button entirely so users can't accidentally log without playing

Standard items render exactly as today.

### 3. Wire it up

At line 204-212 where `<RevealCard ... />` is rendered, pass `onPop={() => { setRevealed(null); navigate({ to: "/popper/balloon" }); }}`. Clearing `revealed` first prevents the card from being there when the user returns to `/menu`.

## Files touched

- `src/routes/_authenticated/menu.tsx` — type extension, `RolledItem` construction, `RevealCard` props/JSX, render-site wiring

## Out of scope

- No changes to `popper/balloon.tsx`, `seedMenu.ts`, or any server function
- No new analytics event (the existing `menu_item_clicked` already fires from `handlePick`; the popper's Done button fires `menu_item_logged` on commit)
- No change to the direct menu-row tap pill behavior — it already navigates correctly

## Tradeoffs

Keeping "Just Roll" on tap reveals lets users skip a balloon they don't feel like popping. Removing the commit button on tap reveals is intentional — logging a "Pop a Balloon" hit without actually popping would be a loophole, and the popper screen already commits on Done with full parity (chime/confetti/milestone).
