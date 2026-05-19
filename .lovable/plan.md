## Tweak Daily Three promo placement & background

Two small changes to `src/lib/email-templates/daily-reminder.tsx`:

1. **Background color**: Change `promoCard.backgroundColor` from `#ffffff` to `#FFF4E0` (same cream as the email container) so the box blends into the page — beige box on beige background, with only the 1px dark border defining it.

2. **Reorder**: Move the `<Section style={promoCard}>` block to render *after* the existing "Daily reminders can be turned off in Account." footer text, so it sits at the very bottom of the email body. Adjust top margin (`margin: '24px 0 8px'` → `margin: '20px 0 0'`) to space it nicely below the footer line.

No other changes.
