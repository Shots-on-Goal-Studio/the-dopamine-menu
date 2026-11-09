# Architecture
- Send app emails only from feature-specific server code through the scaffolded helper; browser input must never choose a recipient or template.
- Keep legacy email tables as historical/audit data, never as send-gating authority; signed email events maintain notification-only records.
- Preserve reminder scheduling and event-based idempotency across email transport updates so user preferences and duplicate prevention remain stable.