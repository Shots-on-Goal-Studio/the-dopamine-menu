## Footer Link to Shots on Goal Studio

Link the "Shots on Goal Studio" text references in the `StudioFooter` component to `http://shotsongoal.studio`.

### What will change
- In `src/components/StudioFooter.tsx`:
  - Wrap "A Shots on Goal Studio product" text in an `<a>` tag linking to `http://shotsongoal.studio`.
  - Wrap "Shots on Goal Studio, LLC" and the trailing "Shots on Goal Studio" text in the copyright line with similar links.
- Link opens in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Preserve all existing styling and structure.