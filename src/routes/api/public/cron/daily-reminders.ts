import * as React from 'react'
import { render } from '@react-email/components'
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { SEED_MENU } from '@/data/seedMenu'
import { TEMPLATES } from '@/lib/email-templates/registry'

// Cron-driven endpoint: for each opted-in user whose local time matches their
// reminder_hour or any of their extra_reminder_hours, enqueue a reminder
// (or "nudge" for extras) into the transactional_emails pgmq queue.

const SITE_NAME = 'Dopamine Menu'
const SENDER_DOMAIN = 'notify.dopamine.shotsongoal.studio'
const FROM_DOMAIN = 'dopamine.shotsongoal.studio'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

type LastSentHours = { date?: string; hours?: number[] }

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

        const reminderTemplate = TEMPLATES['daily-reminder']
        const nudgeTemplate = TEMPLATES['daily-nudge']
        if (!reminderTemplate || !nudgeTemplate) {
          return Response.json({ error: 'reminder templates missing' }, { status: 500 })
        }

        const now = new Date()
        const todayUtc = now.toISOString().slice(0, 10)

        const { data: prefs, error } = await supabase
          .from('email_preferences')
          .select('user_id,timezone,last_sent_on,reminder_hour,extra_reminder_hours,last_sent_hours')
          .eq('daily_reminder', true)
        if (error) {
          return Response.json({ error: error.message }, { status: 500 })
        }

        type DueUser = {
          user_id: string
          localDate: string
          localHour: number
          isExtra: boolean
          alreadySentHours: number[]
        }
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
          const baseHour = typeof p.reminder_hour === 'number' ? p.reminder_hour : 9
          const extras = Array.isArray(p.extra_reminder_hours) ? p.extra_reminder_hours : []
          const isBase = localHour === baseHour
          const isExtra = !isBase && extras.includes(localHour)
          if (!isBase && !isExtra) continue

          const lastSent = (p.last_sent_hours ?? {}) as LastSentHours
          const sentHours =
            lastSent.date === localDate && Array.isArray(lastSent.hours) ? lastSent.hours : []
          if (sentHours.includes(localHour)) continue

          dueUsers.push({
            user_id: p.user_id,
            localDate,
            localHour,
            isExtra,
            alreadySentHours: sentHours,
          })
        }

        const results = await Promise.all(
          dueUsers.map(async ({ user_id, localDate, localHour, isExtra, alreadySentHours }) => {
            const markHourSent = async (extra?: { suppressed?: boolean }) => {
              const nextHours = Array.from(new Set([...alreadySentHours, localHour])).sort(
                (a, b) => a - b,
              )
              await supabase
                .from('email_preferences')
                .update({
                  last_sent_on: localDate,
                  last_sent_hours: { date: localDate, hours: nextHours },
                })
                .eq('user_id', user_id)
              return extra
            }

            try {
              const { data: userRes, error: uErr } = await supabase.auth.admin.getUserById(user_id)
              if (uErr || !userRes.user?.email) {
                return { ok: false, reason: 'no_email' as const }
              }
              const email = userRes.user.email
              const normalizedEmail = email.toLowerCase()

              const { data: suppressed } = await supabase
                .from('suppressed_emails')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle()
              if (suppressed) {
                await supabase.from('email_send_log').insert({
                  message_id: crypto.randomUUID(),
                  template_name: isExtra ? 'daily-nudge' : 'daily-reminder',
                  recipient_email: email,
                  status: 'suppressed',
                })
                await markHourSent()
                return { ok: false, reason: 'suppressed' as const }
              }

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
                return { ok: false, reason: 'token_used' as const }
              }

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

              const tmpl = isExtra ? nudgeTemplate : reminderTemplate
              const templateName = isExtra ? 'daily-nudge' : 'daily-reminder'
              const element = React.createElement(tmpl.component, templateData)
              const html = await render(element)
              const plainText = await render(element, { plainText: true })
              const resolvedSubject =
                typeof tmpl.subject === 'function' ? tmpl.subject(templateData) : tmpl.subject

              const messageId = crypto.randomUUID()
              const idempotencyKey = `daily-${user_id}-${localDate}-${localHour}`

              await supabase.from('email_send_log').insert({
                message_id: messageId,
                template_name: templateName,
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
                  label: templateName,
                  idempotency_key: idempotencyKey,
                  unsubscribe_token: unsubscribeToken,
                  queued_at: new Date().toISOString(),
                },
              })

              if (enqueueError) {
                await supabase.from('email_send_log').insert({
                  message_id: messageId,
                  template_name: templateName,
                  recipient_email: email,
                  status: 'failed',
                  error_message: 'Failed to enqueue',
                })
                return { ok: false, reason: 'enqueue_failed' as const }
              }

              await markHourSent()
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
