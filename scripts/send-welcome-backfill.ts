import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { template } from '/dev-server/src/lib/email-templates/welcome'

const SITE_NAME = 'Dopamine Menu'
const SENDER_DOMAIN = 'notify.dopamine.shotsongoal.studio'
const FROM_DOMAIN = 'dopamine.shotsongoal.studio'

const users = [
  { id: '03e74ace-87d5-4096-9bde-30f387aa9275', email: 'robinsongreig@gmail.com' },
  { id: '232b0c33-caa8-478f-a4ec-b81ec77f0f6e', email: 'maurasully17@gmail.com' },
  { id: 'b8e0b813-10aa-4cb9-a232-9321ef9f6c82', email: 'aaronlsilber@gmail.com' },
  { id: 'fd93f828-e9bd-4028-8366-35e016e1550e', email: 'daniellepierson1@gmail.com' },
  { id: 'b3c89604-d48f-4b0d-a268-1fbe215beb66', email: 'jibbajabba@gmail.com' },
]

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function genToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

const Comp = template.component as any
const subject = typeof template.subject === 'function' ? template.subject({}) : template.subject

const html = await render(Comp({}))
const text = await render(Comp({}), { plainText: true })

for (const u of users) {
  // suppressed?
  const { data: sup } = await supabase.from('suppressed_emails').select('email').eq('email', u.email).maybeSingle()
  if (sup) { console.log('SUPPRESSED', u.email); continue }

  // unsubscribe token
  let { data: tok } = await supabase.from('email_unsubscribe_tokens').select('token').eq('email', u.email).is('used_at', null).maybeSingle()
  let token = tok?.token
  if (!token) {
    token = genToken()
    await supabase.from('email_unsubscribe_tokens').insert({ email: u.email, token })
  }

  const messageId = `welcome-${u.id}`
  await supabase.from('email_send_log').insert({
    message_id: messageId, template_name: 'welcome', recipient_email: u.email, status: 'pending',
  })

  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: u.email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: 'welcome',
      idempotency_key: messageId,
      unsubscribe_token: token,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) { console.error('ENQUEUE FAIL', u.email, error); continue }

  await supabase.from('email_preferences').update({ welcome_sent_at: new Date().toISOString() }).eq('user_id', u.id)
  console.log('QUEUED', u.email)
}
