import { createFileRoute } from '@tanstack/react-router'
import { SEED_MENU } from '@/data/seedMenu'
import { EmailAPIError } from '@lovable.dev/email-js'

// Preserve each user's opted-in local schedule and hourly idempotency.

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

        const { supabaseAdmin: supabase } = await import('@/integrations/supabase/client.server')
        const { sendRecordedEmail } = await import('@/lib/email/send-recorded.server')

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
              const { error: markError } = await supabase
                .from('email_preferences')
                .update({
                  last_sent_on: localDate,
                  last_sent_hours: { date: localDate, hours: nextHours },
                })
                .eq('user_id', user_id)
              if (markError) throw new Error(markError.message)
              return extra
            }

            try {
              const { data: userRes, error: uErr } = await supabase.auth.admin.getUserById(user_id)
              if (uErr || !userRes.user?.email) {
                return { ok: false, reason: 'no_email' as const }
              }
              const email = userRes.user.email
              const { data: customs, error: customsError } = await supabase
                .from('custom_hits')
                .select('name,detail,category')
                .eq('user_id', user_id)

              if (customsError) throw new Error(customsError.message)

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

              if (!pick) return { ok: false, reason: 'empty_pool' as const }

              const templateData = {
                itemName: pick.name,
                detail: pick.detail,
                category: pick.category,
                isCustom: pick.isCustom,
              }

              const templateName = isExtra ? 'daily-nudge' : 'daily-reminder'
              const idempotencyKey = `daily-${user_id}-${localDate}-${localHour}`
              const send = () => sendRecordedEmail(templateName, email, { templateData, idempotencyKey })
              let result
              try {
                result = await send()
              } catch (error) {
                if (!(error instanceof EmailAPIError) || error.status !== 429) throw error
                await new Promise((resolve) => setTimeout(resolve, (error.retryAfterSeconds ?? 60) * 1000))
                result = await send()
              }
              if (!result.sent) {
                await markHourSent()
                return { ok: false, reason: 'suppressed' as const }
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
