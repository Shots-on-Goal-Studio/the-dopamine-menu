## Make menu items tappable

The tagline promises "Pick a healthy hit. Or let chance decide." but only the roll path exists. This plan adds a direct-pick path with the same commit/celebration behavior as a roll.

### Behavior

- Clicking any item row (seed or custom) in The Menu commits that item immediately — same flow as confirming a rolled item.
- Triggers the same success effects: streak increment, confetti (24 first-of-day / 18 otherwise / 80 on milestone), chime, milestone overlay when applicable.
- The reveal card is NOT shown for direct picks (user already chose intentionally; no need to re-confirm).
- Custom items: clicking the row commits. The "×" delete button keeps its own click handler (stopPropagation) so deleting never commits.
- The "+ Add your own" button and the inline AddForm inputs are unaffected.
- Hover affordance on rows: subtle background tint + cursor-pointer so it's discoverable. No layout shift.
- Roll button + reveal card flow remains unchanged for users who want chance to decide.

### Files to change

- `src/routes/_authenticated/menu.tsx`
  - `Menu` / `Section` / `ItemRow`: accept an `onPick(name, category, isCustom)` callback; wire it onto the row's click handler.
  - `ItemRow`: make the row a `<button>` (or div with role=button) with hover style; ensure the delete `×` calls `e.stopPropagation()`.
  - `MenuPage`: add a `pickMut` (or reuse `commitMut`) that calls `commitFn` directly without going through `revealed` state. Reuse existing success handler logic (extract to a small helper to avoid duplication).

No data model, server function, or styles.css changes needed.
