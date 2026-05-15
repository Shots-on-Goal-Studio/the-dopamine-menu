## Tapping a menu item opens the reveal card

Replace the current "tap-to-commit-immediately" behavior with a confirmation step that reuses the existing reveal card.

### Behavior

- Tapping any menu item (seed or custom) sets that item as `revealed` and scrolls/renders the inline reveal card — same card the roll button uses.
- Card buttons:
  - **Just roll** — picks a random item from the full pool (same logic as the current roll button) and replaces what's shown in the card. Card stays open.
  - **I did it ✓** — commits the currently shown item. Triggers existing confetti / chime / streak / milestone behavior.
- No modal, no backdrop. Inline card, identical visual treatment to the roll path.
- Custom item delete `×` keeps `stopPropagation` so deleting never opens the card.

### Files to change

- `src/routes/_authenticated/menu.tsx`
  - Remove `pickMut` and the direct-commit path on row click.
  - `onPick` callback now does: build a `RolledItem` from the tapped row (looking up `detail` from `SEED_MENU` for seed rows, or from `customHits` for custom rows) and call `setRevealed(item)`.
  - `RevealCard`: rename the left button label from "Roll again" to "Just roll" — behavior is unchanged (still calls `roll()` which picks a random item and updates `revealed`).
  - `ItemRow` / `Section` / `Menu`: keep the tappable button shape and hover affordance; drop the `picking` disabled state (commit only happens from the card now, so no race to guard against on the rows).

No data model, server function, or styles.css changes.
