import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { SEED_MENU } from '@/data/seedMenu'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Dopamine Menu'
const SENDER_DOMAIN = 'notify.dopamine.shotsongoal.studio'
const FROM_DOMAIN = 'dopamine.shotsongoal.studio'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function localDateFor(tz: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now)
    const get = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

const TARGET_TZ = new Set([
  'UTC',
  'America/New_York',
  'Europe/Helsinki',
  'Europe/Vilnius',
])

async function main() {
  const template = TEMPLATES['daily-reminder']
  if (!template) throw new Error('daily-reminder template missing')

  const { data: prefs, error } = await supabase
    .from('email_preferences')
    .select('user_id,timezone,last_sent_on,reminder_hour')
    .eq('daily_reminder', true)
    .is('last_sent_on', null)
  if (error) throw error

  const now = new Date()
  const targets = (prefs ?? []).filter((p) => TARGET_TZ.has(p.timezone || 'UTC'))
  console.log(`Backfilling ${targets.length} users`)

  const results = await Promise.all(targets.map(async (p) => {
    const user_id = p.user_id
    const localDate = localDateFor(p.timezone || 'UTC', now)
    try {
      const { data: userRes, error: uErr } = await supabase.auth.admin.getUserById(user_id)
      if (uErr || !userRes.user?.email) return { user_id, ok: false, reason: 'no_email' }
      const email = userRes.user.email
      const normalizedEmail = email.toLowerCase()

      const { data: suppressed } = await supabase
        .from('suppressed_emails').select('id').eq('email', normalizedEmail).maybeSingle()
      if (suppressed) {
        await supabase.from('email_send_log').insert({
          message_id: crypto.randomUUID(), template_name: 'daily-reminder',
          recipient_email: email, status: 'suppressed',
        })
        await supabase.from('email_preferences').update({ last_sent_on: localDate }).eq('user_id', user_id)
        return { user_id, ok: false, reason: 'suppressed' }
      }

      let unsubscribeToken: string
      const { data: existingToken } = await supabase
        .from('email_unsubscribe_tokens').select('token, used_at').eq('email', normalizedEmail).maybeSingle()
      if (existingToken && !existingToken.used_at) {
        unsubscribeToken = existingToken.token
      } else if (!existingToken) {
        unsubscribeToken = generateToken()
        await supabase.from('email_unsubscribe_tokens')
          .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true })
        const { data: stored } = await supabase
          .from('email_unsubscribe_tokens').select('token').eq('email', normalizedEmail).maybeSingle()
        if (!stored) return { user_id, ok: false, reason: 'token_failed' }
        unsubscribeToken = stored.token
      } else {
        return { user_id, ok: false, reason: 'token_used' }
      }

      const { data: customs } = await supabase
        .from('custom_hits').select('name,detail,category').eq('user_id', user_id)
      const pool = [
        ...SEED_MENU.map((s) => ({ ...s, isCustom: false })),
        ...((customs ?? []) as any[]).map((c) => ({
          name: c.name, detail: c.detail ?? '', category: c.category, isCustom: true,
        })),
      ]
      if (pool.length === 0) return { user_id, ok: false, reason: 'empty_pool' }
      const pick = pool[Math.floor(Math.random() * pool.length)]
      const templateData = {
        itemName: pick.name, detail: pick.detail, category: pick.category, isCustom: pick.isCustom,
      }

      const element = React.createElement(template.component, templateData)
      const html = await render(element)
      const plainText = await render(element, { plainText: true })
      const subject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject

      const messageId = crypto.randomUUID()
      const idempotencyKey = `daily-${user_id}-${localDate}`

      await supabase.from('email_send_log').insert({
        message_id: messageId, template_name: 'daily-reminder', recipient_email: email, status: 'pending',
      })

      const { error: enqueueError } = await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          message_id: messageId, to: email,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN, subject, html, text: plainText,
          purpose: 'transactional', label: 'daily-reminder',
          idempotency_key: idempotencyKey, unsubscribe_token: unsubscribeToken,
          queued_at: new Date().toISOString(),
        },
      })
      if (enqueueError) {
        await supabase.from('email_send_log').insert({
          message_id: messageId, template_name: 'daily-reminder', recipient_email: email,
          status: 'failed', error_message: 'Failed to enqueue: ' + enqueueError.message,
        })
        return { user_id, ok: false, reason: 'enqueue_failed', err: enqueueError.message }
      }
      await supabase.from('email_preferences').update({ last_sent_on: localDate }).eq('user_id', user_id)
      return { user_id, email, ok: true }
    } catch (e: any) {
      return { user_id, ok: false, reason: 'exception', err: e?.message }
    }
  }))

  console.log(JSON.stringify(results, null, 2))
  const sent = results.filter((r) => r.ok).length
  console.log(`\nSent: ${sent} / ${results.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
