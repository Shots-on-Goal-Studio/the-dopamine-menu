# Balloon Popper: polish + true pop counter

## 1. Tighten the balloon "appearance" jitter

Today every pop calls `randomBalloon()` which randomizes **x position** (15–85%) **and size** (140–220px), and the new balloon mounts with a `dopamine-bounce` keyframe (scale + slight translate). Combined, that reads as a "jutted flash" — the balloon teleports horizontally and resizes at the same moment the bounce kicks in.

Fix (frontend only, in `src/routes/_authenticated/popper/balloon.tsx`):

- **Lock the size.** Use a single fixed size (e.g. `180`) instead of `140 + random*80`. Removes the resize pop.
- **Constrain horizontal drift.** Narrow `xPct` to `40–60%` (was `15–85%`), so the new balloon appears near where the popped one was instead of jumping across the stage.
- **Soften the entrance.** Replace the springy `dopamine-bounce` (cubic-bezier(0.34,1.56,0.64,1) — overshoots) with a quick, non-overshooting fade+scale, e.g. `dopamine-balloon-in 180ms ease-out` defined inline / in `styles.css`:
  ```
  @keyframes dopamine-balloon-in {
    from { opacity: 0; transform: translateX(-50%) scale(0.92); }
    to   { opacity: 1; transform: translateX(-50%) scale(1); }
  }
  ```
  Note the `translateX(-50%)` is preserved through the keyframe so the existing centering trick still works (right now the bounce keyframe clobbers it, which contributes to the perceived shift).
- Keep color randomization — that variety is fine and doesn't cause layout shift.

Net effect: balloons appear in roughly the same spot, same size, with a gentle fade-in. Pops still feel snappy because `popSound` + confetti fire instantly.

## 2. Real-time, true all-time pop counter

Today `getBalloonPopsTotal` counts rows in `dopamine_logs` where `item_name='Pop a Balloon'`. That's **commits (Done ✓ presses)**, not individual pops. And it only refreshes after invalidation post-commit.

Approach: store cumulative pops in a dedicated row, increment per pop, optimistic UI.

### Database (new migration)

New table `balloon_pop_counters`:
```
user_id uuid primary key references auth.users(id) on delete cascade
total   bigint not null default 0
updated_at timestamptz not null default now()
```
RLS: select/insert/update only `where user_id = auth.uid()`. (No delete policy — we never delete.)

### Server functions (`src/lib/popper.functions.ts`)

- Replace `getBalloonPopsTotal` to read from `balloon_pop_counters` (returns 0 if row missing).
- Add `incrementBalloonPops({ delta: number (1..50) })` — upserts the user's row with `total = total + delta`, returns new total. Batched delta so we can debounce client→server traffic instead of one RPC per tap.

### Client (`balloon.tsx`)

- Seed local `allTime` from `useQuery(['popper','balloon','total'])`.
- On every `pop()`: increment local `allTime` immediately (real-time display, matches session counter behavior) and enqueue a pending delta.
- Flush pending delta to `incrementBalloonPops` on a 600ms debounce, on `visibilitychange`/`pagehide`/`beforeunload`, and right before `commitMut` runs. On success, reconcile with server total (in case of races).
- Remove the post-commit invalidation of the total query (no longer needed; we trust the local mirror, and a fresh mount re-fetches).

### Why a separate counter vs. a `pops` column on logs

A "pops per session" column on `dopamine_logs` would only update on Done ✓, so the all-time number still wouldn't tick in real time across sessions / refreshes. A dedicated counter is the simplest source of truth for "total balloons ever popped" and trivially RLS-protected.

## Out of scope
- Changing how Done ✓ / streak / milestones work.
- Touching menu.tsx, seedMenu, or other surfaces.
- Backfilling historic pop counts (there's no record of past pops — counter starts at current value of 0 for everyone; existing commits remain in dopamine_logs untouched).

## Files
- `src/routes/_authenticated/popper/balloon.tsx` — animation + counter wiring
- `src/styles.css` — add `dopamine-balloon-in` keyframe
- `src/lib/popper.functions.ts` — swap reader, add incrementer
- New migration — `balloon_pop_counters` table + RLS
