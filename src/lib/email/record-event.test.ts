import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailWebhookEvent } from '@lovable.dev/email-js'

const mocks = vi.hoisted(() => ({ upsert: vi.fn() }))
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: () => ({ upsert: mocks.upsert }) } }))
import { recordEmailEvent } from './record-event.server'

describe('kept terminal-event data contract', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.upsert.mockResolvedValue({ error: null }) })
  const cases = [
    ['email.bounced', 'bounce', 'bounced', 'Permanent bounce — email address is invalid or rejected'],
    ['email.complaint', 'complaint', 'complained', 'Spam complaint — recipient marked email as spam'],
    ['email.unsubscribed', 'unsubscribe', 'suppressed', 'Recipient unsubscribed'],
  ] as const
  for (const [type, reason, status, message] of cases) {
    it(`preserves ${type} values and deduplicates by event id`, async () => {
      const event: EmailWebhookEvent<typeof type> = { event_id: 'event-1', run_id: 'run-1', type, project_id: 'test', environment: 'dev', timestamp: '2026-05-21T09:00:00Z', version: '1', data: { event: type, recipient: 'Member@Example.test', message_id: 'message-1' } }
      await recordEmailEvent(event)
      await recordEmailEvent(event)
      expect(mocks.upsert.mock.calls[0]?.[0]).toEqual({ email: 'member@example.test', reason, metadata: null })
      expect(mocks.upsert.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ status, error_message: message, template_name: 'system', metadata: null }))
      expect(mocks.upsert.mock.calls[1]?.[0].id).toEqual(mocks.upsert.mock.calls[3]?.[0].id)
      expect(mocks.upsert.mock.calls[1]?.[1]).toEqual({ onConflict: 'id', ignoreDuplicates: true })
    })
  }
})