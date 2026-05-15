## Fix smushed streak circles on mobile

The StreakSection wraps 7 fixed 22px circles + 6 gaps inside a card that has 32px horizontal padding and 32px column gap. On a 390px viewport that leaves the circle row with too little width, so the circles overlap their borders.

### Change

In `src/routes/_authenticated/menu.tsx` `StreakSection`:

- Card padding: `px-8` → `px-4 sm:px-8`
- Outer grid gap: `gap-8` → `gap-4 sm:gap-8`
- Left column right padding (the divider gutter): `pr-7` → `pr-4 sm:pr-7`
- Day-circle grid: `gap-2` → `gap-1.5 sm:gap-2`

Circle size, colors, border, and the dashed divider stay unchanged. Tablet/desktop layout is identical to today.
