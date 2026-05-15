## Compact Userbar streak on mobile

On narrow viewports the streak text wraps the right group below the logo. Shortening it to `{n} day 🔥` (drop the word "streak") keeps everything on one row.

### Change

In `src/routes/_authenticated/menu.tsx` `Userbar` component:

- In the streak label, wrap the word `streak` in a `<span className="hidden sm:inline">streak </span>` so it's hidden below the `sm` breakpoint (640px) and shown unchanged on tablet/desktop.
- Result on mobile: `1 day 🔥` + avatar, on the same row as the logo.
- No other layout, spacing, or font changes.
