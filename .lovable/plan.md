## Add Daily Three cross-promo to the daily reminder email

Add a subtle, secondary bordered card to the bottom of the daily reminder email (above the existing "Daily reminders can be turned off..." footer) promoting Daily Three as another tool for the ADHD brain.

### Placement

In `src/lib/email-templates/daily-reminder.tsx`, insert a new `<Section>` after the "OPEN MY MENU" CTA wrap and before the final account/unsubscribe footer text.

### Visual treatment

A bordered card that is clearly secondary to the yellow/teal/pink "hit of the day" card:

- White background (vs the page's cream `#FFF4E0`) so it reads as a distinct but quiet block
- Thinner 1px border in `#1A1A2E` (vs the 3px brutalist borders elsewhere)
- No drop shadow, no bold accent fill
- Slightly muted text, smaller heading than the main h1
- Compact padding (~16px) — visibly smaller footprint than the main card
- Small inline kicker label "MORE TOOLS FOR THE ADHD BRAIN" in the existing kicker style but lower contrast
- Heading "Meet Daily Three" in DM Serif Display (matches `cardTitle` family but smaller, ~18px)
- One-line description: "Pick three things that matter today. Do those. That's it."
- Text-style link "Try Daily Three →" in the existing pink (`#FF2E63`) — no big filled button so it doesn't compete with OPEN MY MENU

### Copy (draft — user didn't specify)

- Kicker: `MORE TOOLS FOR THE ADHD BRAIN`
- Heading: `Meet Daily Three`
- Body: `Pick three things that matter today. Do those. That's it.`
- Link text: `Try Daily Three →`
- Destination: `https://dailythree.shotsongoal.studio/`

### Files changed

- `src/lib/email-templates/daily-reminder.tsx` — add the new Section in JSX + add `promoCard`, `promoKicker`, `promoTitle`, `promoText`, `promoLink` style constants at the bottom.

No other files change. No infrastructure changes. Takes effect on next publish.
