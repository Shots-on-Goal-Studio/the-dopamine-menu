## Drop per-item minutes on mobile, add tap cue

Each section already labels its time once in the header (e.g. "~ 2 min"), so repeating the cost on every row on mobile is noise. Replace it with a subtle chevron that hints at tappability.

### Change

In `src/routes/_authenticated/menu.tsx` `ItemRow`:

- Hide the cost `<span>` on mobile, show on `sm` and up: add `className="hidden sm:inline"` to it.
- Hide the dotted leader on mobile too (it only makes sense paired with the cost on the right): wrap with `hidden sm:block`.
- Add a mobile-only chevron at the right edge: `<span className="sm:hidden ml-2 opacity-40 group-hover:opacity-80 transition-opacity" aria-hidden>›</span>` styled with `font-body`, color `var(--ink)`, fontSize 18.
- Item name span gets `flex-1` on mobile so it can extend wider; on `sm` it returns to the current "name + leader + cost" layout. Easiest: add `flex-1 sm:flex-none` to the name span.

Custom-item delete `×` and the existing tap behavior stay unchanged. Desktop/tablet rendering is identical to today.
