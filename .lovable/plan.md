# Sound-on hint for Pop a Balloon

## Goal
Gently nudge the user to turn their device sound on so the pop chimes/confetti audio land. Visual only — no audio API changes, no settings toggle.

## Where
`src/routes/_authenticated/popper/balloon.tsx`, in the header block just under the italic instruction line ("Tap the balloon. Tap again…"). One small, on-brand inline hint — not a modal, not a toast.

## What it looks like
A single centered pill/row, small and quiet so it doesn't compete with the H1:

```
🔊  Sound on for the full effect
```

- Speaker icon (lucide `Volume2`) at ~14px, color `var(--pink)`.
- Label in `var(--font-body)`, ~11px, uppercase, letter-spacing `0.2em`, color `var(--ink)` at ~70% opacity.
- Thin 1.5px border in `var(--ink)` at low opacity, ~6px 12px padding, square corners to match the existing brutalist buttons.
- Centered, ~16px top margin from the italic line, ~8px bottom margin before the stage.

## Behavior
- Static. No dismiss button, no localStorage — it's a one-line reminder, not a banner.
- Renders the same on mobile and desktop (already narrow enough to fit a 320px viewport).
- Decorative — `aria-hidden="false"` so screen readers still announce "Sound on for the full effect"; icon gets `aria-hidden`.

## Out of scope
- No mute/unmute toggle.
- No autoplay-unlock logic (audio already unlocks on first tap via existing `popSound` / `playChime`).
- No changes to counters, balloon placement, commit flow, or styles.css.

## Files
- `src/routes/_authenticated/popper/balloon.tsx` (single insertion in the header JSX + one icon import from `lucide-react`).
