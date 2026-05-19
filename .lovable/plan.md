## Problem

`/admin/usage` crashes with React error #310 ("Rendered more hooks than during the previous render").

**Root cause:** In `AdminUsagePage`, the hooks run in this order on the first render (while `useIsAdmin` is loading):

1. `useIsAdmin()` → `useQuery`
2. `useServerFn`
3. `useQuery` (stats)
4. *early return* `Checking access…`

Then once the role resolves and `isAdmin === true`, the component renders again and reaches:

5. `useMemo(...)` for pie data

React sees a new hook (`useMemo`) that wasn't called previously → throws #310. Same problem would happen for the non-admin early-return path.

## Fix

Move `useMemo` above the early returns so the hook order is identical on every render. Trivial reorder, no other logic changes.

### Change to `src/routes/_authenticated/admin/usage.tsx`

In `AdminUsagePage`, call `useMemo` immediately after the `useQuery` for stats, *before* the `if (roleLoading)` and `if (!isAdmin)` guards. Everything else stays the same.

### Verification

Reload `/admin/usage` as admin — page renders the dashboard. As non-admin — page renders the "Not authorized" state without crashing.
