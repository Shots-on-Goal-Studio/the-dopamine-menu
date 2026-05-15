## Widen menu rows on mobile, push chevron to the edge

The Menu wrapper has `px-10` (40px) padding on all sides. On mobile that pinches every row inward, leaving the chevron well short of the dashed header divider's right end.

### Changes

In `src/routes/_authenticated/menu.tsx`:

- `Menu` wrapper: `px-10 pb-10 pt-12` → `px-4 sm:px-10 pb-10 pt-12`. Reduces left/right padding on mobile so the row grid (and the dashed section divider above it) span closer to the card edges.
- `ItemRow` chevron: bump its left margin from `ml-2` to `ml-auto` so it's pinned to the right edge of the row regardless of name length, and increase its right padding alignment by removing the `-mx-2` row inset on mobile only? — simpler: keep row padding as-is and just `ml-auto` does the trick.

That gives wider items and a chevron sitting at the row's right edge, lining up with the right end of the dashed header divider above. No desktop/tablet change.
