import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn(), insert: vi.fn() }))
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: () => ({ insert: mocks.insert }) } }))
vi.mock('@/lib/email-templates/send-email', () => ({ sendTemplateEmail: mocks.send }))
import { sendRecordedEmail } from './send-recorded.server'

describe('email audit parity', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.insert.mockResolvedValue({ error: null }) })
  it('records sent only after a successful send, preserving event identity', async () => {
    mocks.send.mockResolvedValue({ sent: true })
    await sendRecordedEmail('daily-reminder', 'member@example.test', { idempotencyKey: 'daily-user-2026-05-21-9' })
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', template_name: 'daily-reminder', message_id: 'daily-user-2026-05-21-9' }))
  })
  it('records suppression and never retries it', async () => {
    mocks.send.mockResolvedValue({ sent: false, reason: 'recipient_suppressed' })
    expect(await sendRecordedEmail('welcome', 'member@example.test', {})).toEqual({ sent: false, reason: 'recipient_suppressed' })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'suppressed' }))
  })
  it('records failed with the original error and propagates failure', async () => {
    mocks.send.mockRejectedValue(new Error('domain_not_verified'))
    await expect(sendRecordedEmail('daily-nudge', 'member@example.test', {})).rejects.toThrow('domain_not_verified')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error_message: 'domain_not_verified' }))
  })
  it('audit rejection does not turn a successful send into a failed send', async () => {
    mocks.send.mockResolvedValue({ sent: true })
    mocks.insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendRecordedEmail('welcome', 'member@example.test', {})).toEqual({ sent: true })
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})