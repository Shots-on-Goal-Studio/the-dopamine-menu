# Balloon placement: vary position within safe bounds

## Goal
Each new balloon appears in a different spot inside the dark box so the user has to move cursor/finger, but the balloon is always fully inside the box on every screen size.

## Approach (frontend only, `src/routes/_authenticated/popper/balloon.tsx`)

1. **Measure the stage.** Add a `ref` to the dark box and a `ResizeObserver` that stores `{ width, height }` in state. Re-measure on mount and on viewport resize so mobile/tablet/desktop all get correct bounds.

2. **Pick a responsive size.** Compute `size = clamp(120, containerWidth * 0.40, 180)`. Caps at 180 on desktop, shrinks gracefully on narrow screens. Balloon height is `size * 1.18` plus a small string (~12% extra).

3. **Compute safe placement window** each pop:
   - Horizontal: with `translateX(-50%)`, valid `xPct` range is `[(size/2 + pad) / W * 100, 100 - (size/2 + pad) / W * 100]` where `pad ≈ 12px` for breathing room.
   - Vertical: switch from a fixed `bottom: 24` to a randomized `bottomPx` in `[12, containerHeight - balloonTotalHeight - 12]`. Falls back to centered if the range collapses.

4. **Avoid repeats.** Track the previous balloon's `{ xPct, bottomPx }` in a ref. When rolling a new balloon, reject candidates whose center is within ~35% of the box's smaller dimension from the previous spot; retry up to 6 times, then accept. Guarantees visible movement without infinite loops.

5. **Apply to the rendered balloon.** Replace the fixed `bottom: 24` with the computed `bottomPx`. `xPct` already drives `left`. The existing `dopamine-balloon-in` keyframe (translateX(-50%) + scale) stays as-is — still snappy and overshoot-free.

6. **First balloon.** Pick a random spot from the same logic once `containerSize` is known; until then, fall back to centered (current behavior) so there's no flash.

## Out of scope
- Counter logic, sounds, confetti, commit flow, milestones — untouched.
- No new colors, animations, or copy.
- No DB or server-fn changes.

## Files
- `src/routes/_authenticated/popper/balloon.tsx`
