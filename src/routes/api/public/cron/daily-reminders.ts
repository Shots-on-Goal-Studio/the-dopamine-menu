import * as React from 'react'
import { render } from '@react-email/components'
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { SEED_MENU } from '@/data/seedMenu'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Cron-driven endpoint: picks one random hit per opted-in user whose
// local time is currently in their reminder_hour, and enqueues a daily reminder
// directly into the transactional_emails pgmq queue (no HTTP hop).
// Auth: apikey header must match the Supabase publishable key.

const SITE_NAME = 'Dopamine Menu'
const SENDER_DOMAIN = 'notify.dopamine.shotsongoal.studio'
const FROM_DOMAIN = 'dopamine.shotsongoal.studio'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const Route = createFileRoute('/api/public/cron/daily-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        const apiKey = request.headers.get('apikey')
        if (!expectedKey || apiKey !== expectedKey) {
          return new Response('Unauthorized', { status: 401 })
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return new Response('Server misconfigured', { status: 500 })
        }
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        const template = TEMPLATES['daily-reminder']
        if (!template) {
          return Response.json({ error: 'daily-reminder template missing' }, { status: 500 })
        }

        const now = new Date()
        const todayUtc = now.toISOString().slice(0, 10)

        const { data: prefs, error } = await supabase
          .from('email_preferences')
          .select('user_id,timezone,last_sent_on,reminder_hour')
          .eq('daily_reminder', true)
        if (error) {
          return Response.json({ error: error.message }, { status: 500 })
        }

        type DueUser = { user_id: string; localDate: string }
        const dueUsers: DueUser[] = []
        for (const p of prefs ?? []) {
          let localHour = -1
          let localDate = todayUtc
          try {
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone: p.timezone || 'UTC',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', hour12: false,
            }).formatToParts(now)
            const get = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
            localHour = parseInt(get('hour'), 10)
            localDate = `${get('year')}-${get('month')}-${get('day')}`
          } catch {
            localHour = now.getUTCHours()
          }
          const targetHour = typeof p.reminder_hour === 'number' ? p.reminder_hour : 9
          if (localHour !== targetHour) continue
          if (p.last_sent_on === localDate) continue
          dueUsers.push({ user_id: p.user_id, localDate })
        }

        // Process users in parallel to stay under pg_net's 5s budget.
        const results = await Promise.all(
          dueUsers.map(async ({ user_id, localDate }) => {
            try {
              const { data: userRes, error: uErr } = await supabase.auth.admin.getUserById(user_id)
              if (uErr || !userRes.user?.email) {
                return { ok: false, reason: 'no_email' as const }
              }
              const email = userRes.user.email
              const normalizedEmail = email.toLowerCase()

              // Suppression check
              const { data: suppressed } = await supabase
                .from('suppressed_emails')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle()
              if (suppressed) {
                await supabase.from('email_send_log').insert({
                  message_id: crypto.randomUUID(),
                  template_name: 'daily-reminder',
                  recipient_email: email,
                  status: 'suppressed',
                })
                // Mark as sent for the day so we don't retry every 15 min.
                await supabase
                  .from('email_preferences')
                  .update({ last_sent_on: localDate })
                  .eq('user_id', user_id)
                return { ok: false, reason: 'suppressed' as const }
              }

              // Get-or-create unsubscribe token
              let unsubscribeToken: string
              const { data: existingToken } = await supabase
                .from('email_unsubscribe_tokens')
                .select('token, used_at')
                .eq('email', normalizedEmail)
                .maybeSingle()

              if (existingToken && !existingToken.used_at) {
                unsubscribeToken = existingToken.token
              } else if (!existingToken) {
                unsubscribeToken = generateToken()
                await supabase
                  .from('email_unsubscribe_tokens')
                  .upsert(
                    { token: unsubscribeToken, email: normalizedEmail },
                    { onConflict: 'email', ignoreDuplicates: true },
                  )
                const { data: storedToken } = await supabase
                  .from('email_unsubscribe_tokens')
                  .select('token')
                  .eq('email', normalizedEmail)
                  .maybeSingle()
                if (!storedToken) return { ok: false, reason: 'token_failed' as const }
                unsubscribeToken = storedToken.token
              } else {
                // Token used but not suppressed — skip safely.
                return { ok: false, reason: 'token_used' as const }
              }

              // Pull custom hits + pick one item
              const { data: customs } = await supabase
                .from('custom_hits')
                .select('name,detail,category')
                .eq('user_id', user_id)

              const pool = [
                ...SEED_MENU.map((s) => ({ ...s, isCustom: false })),
                ...((customs ?? []) as Array<{ name: string; detail: string | null; category: 'quick' | 'medium' | 'big' }>).map((c) => ({
                  name: c.name,
                  detail: c.detail ?? '',
                  category: c.category,
                  isCustom: true,
                })),
              ]
              if (pool.length === 0) return { ok: false, reason: 'empty_pool' as const }
              const pick = pool[Math.floor(Math.random() * pool.length)]

              const templateData = {
                itemName: pick.name,
                detail: pick.detail,
                category: pick.category,
                isCustom: pick.isCustom,
              }

              const element = React.createElement(template.component, templateData)
              const html = await render(element)
              const plainText = await render(element, { plainText: true })
              const resolvedSubject =
                typeof template.subject === 'function'
                  ? template.subject(templateData)
                  : template.subject

              const messageId = crypto.randomUUID()
              const idempotencyKey = `daily-${user_id}-${localDate}`

              await supabase.from('email_send_log').insert({
                message_id: messageId,
                template_name: 'daily-reminder',
                recipient_email: email,
                status: 'pending',
              })

              const { error: enqueueError } = await supabase.rpc('enqueue_email', {
                queue_name: 'transactional_emails',
                payload: {
                  message_id: messageId,
                  to: email,
                  from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                  sender_domain: SENDER_DOMAIN,
                  subject: resolvedSubject,
                  html,
                  text: plainText,
                  purpose: 'transactional',
                  label: 'daily-reminder',
                  idempotency_key: idempotencyKey,
                  unsubscribe_token: unsubscribeToken,
                  queued_at: new Date().toISOString(),
                },
              })

              if (enqueueError) {
                await supabase.from('email_send_log').insert({
                  message_id: messageId,
                  template_name: 'daily-reminder',
                  recipient_email: email,
                  status: 'failed',
                  error_message: 'Failed to enqueue',
                })
                return { ok: false, reason: 'enqueue_failed' as const }
              }

              await supabase
                .from('email_preferences')
                .update({ last_sent_on: localDate })
                .eq('user_id', user_id)

              return { ok: true as const }
            } catch (e) {
              console.error('daily reminder failed for user', user_id, e)
              return { ok: false, reason: 'exception' as const }
            }
          }),
        )

        const sent = results.filter((r) => r.ok).length
        const failed = results.length - sent
        return Response.json({
          ok: true,
          considered: prefs?.length ?? 0,
          due: dueUsers.length,
          sent,
          failed,
        })
      },
    },
  },
})
