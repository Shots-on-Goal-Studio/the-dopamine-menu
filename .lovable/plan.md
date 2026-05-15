## Center the reveal card in viewport on roll/pick

When `revealed` changes (either from "Give Me One" or a menu item tap), scroll so the reveal card sits vertically centered in the viewport.

### Implementation

In `src/routes/_authenticated/menu.tsx`:

- Add a `revealRef = useRef<HTMLDivElement>(null)` in `MenuPage`.
- Pass `revealRef` to `RevealCard` and attach it to the card's outermost `<div>`.
- Add `useEffect(() => { if (revealed) revealRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [revealed])`.
- Remove the existing `window.scrollTo({ top: 0, ... })` from `handlePick` (replaced by the effect, which also covers the roll button path).
- Add `useRef` to the React import.

No other behavior changes.
