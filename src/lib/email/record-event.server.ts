import type { EmailWebhookEvent } from '@lovable.dev/email-js'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const outcomes = {
  'email.bounced': { reason: 'bounce', status: 'bounced', message: 'Permanent bounce — email address is invalid or rejected' },
  'email.complaint': { reason: 'complaint', status: 'complained', message: 'Spam complaint — recipient marked email as spam' },
  'email.unsubscribed': { reason: 'unsubscribe', status: 'suppressed', message: 'Recipient unsubscribed' },
} as const

export async function recordEmailEvent(event: EmailWebhookEvent<'email.bounced' | 'email.complaint' | 'email.unsubscribed'>) {
  const outcome = outcomes[event.type]
  const recipient = event.data.recipient.toLowerCase()
  const { error: suppressionError } = await supabaseAdmin.from('suppressed_emails').upsert({
    email: recipient, reason: outcome.reason, metadata: null,
  }, { onConflict: 'email' })
  if (suppressionError) throw new Error(`Email event write failed: ${suppressionError.code} ${suppressionError.message}`)

  // Deterministic primary key makes redelivered events append exactly once.
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(event.event_id)))
  hash[6] = ((hash[6] ?? 0) & 15) | 80
  hash[8] = ((hash[8] ?? 0) & 63) | 128
  const hex = Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  const { error: logError } = await supabaseAdmin.from('email_send_log').upsert({
    id, message_id: event.data.message_id ?? null, template_name: 'system',
    recipient_email: recipient, status: outcome.status, error_message: outcome.message, metadata: null,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (logError) throw new Error(`Email event log failed: ${logError.code} ${logError.message}`)
}