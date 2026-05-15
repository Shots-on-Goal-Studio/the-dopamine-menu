## Repair plan

The build is throwing `ReferenceError: useEffect is not defined` in `src/routes/_authenticated/menu.tsx` (Userbar component). The `Userbar` uses `useEffect` but the React import line only pulls `useMemo, useState`.

### Single change
- `src/routes/_authenticated/menu.tsx` line 1: change
  `import { useMemo, useState } from "react";` → `import { useEffect, useMemo, useState } from "react";`

### Verification
- Reload `/menu` and confirm no console error.
- Confirm masthead, week strip, roll button, menu sections, and StudioFooter render.
- Spot-check a roll → "I did it ✓" commit (confetti + chime + streak update).

No other files need changes for the repair. If runtime surfaces additional issues after this fix, I'll address them in follow-up.