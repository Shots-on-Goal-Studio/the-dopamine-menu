## Stack menu items full-width on mobile

The Section's item grid is hard-coded to two columns. Make it one column below the `sm` breakpoint (640px), two columns at `sm` and up.

### Change

In `src/routes/_authenticated/menu.tsx` `Section` component:

- Replace the inline `style={{ gridTemplateColumns: "1fr 1fr" }}` on the items grid with Tailwind classes: `grid-cols-1 sm:grid-cols-2`.
- Keep `gap-x-9 gap-y-3` unchanged (column gap simply has no effect at one column).

No other changes.
