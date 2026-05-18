import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { SEED_MENU } from '@/data/seedMenu'

// Cron-driven endpoint: picks one random hit per opted-in user whose
// local time is currently in the 8 AM hour, and enqueues a daily reminder.
// Auth: apikey header must match the Supabase publishable key.

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

        const now = new Date()
        const todayUtc = now.toISOString().slice(0, 10)

        // Pull opted-in users not yet sent today.
        const { data: prefs, error } = await supabase
          .from('email_preferences')
          .select('user_id,timezone,last_sent_on,reminder_hour')
          .eq('daily_reminder', true)
        if (error) {
          return Response.json({ error: error.message }, { status: 500 })
        }

        const dueUsers = (prefs ?? []).filter((p) => {
          // Determine local hour for the user
          let localHour = -1
          let localDate = todayUtc
          try {
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone: p.timezone || 'UTC',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              hour12: false,
            }).formatToParts(now)
            const get = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
            localHour = parseInt(get('hour'), 10)
            localDate = `${get('year')}-${get('month')}-${get('day')}`
          } catch {
            localHour = now.getUTCHours()
          }
          const targetHour = typeof p.reminder_hour === 'number' ? p.reminder_hour : 9
          if (localHour !== targetHour) return false
          if (p.last_sent_on === localDate) return false
          return true
        })

        let sent = 0
        let failed = 0

        for (const p of dueUsers) {
          try {
            // Look up email
            const { data: userRes, error: uErr } = await supabase.auth.admin.getUserById(p.user_id)
            if (uErr || !userRes.user?.email) {
              failed++
              continue
            }
            const email = userRes.user.email

            // Pull custom hits
            const { data: customs } = await supabase
              .from('custom_hits')
              .select('name,detail,category')
              .eq('user_id', p.user_id)

            const pool = [
              ...SEED_MENU.map((s) => ({ ...s, isCustom: false })),
              ...((customs ?? []) as Array<{ name: string; detail: string | null; category: 'quick' | 'medium' | 'big' }>).map((c) => ({
                name: c.name,
                detail: c.detail ?? '',
                category: c.category,
                isCustom: true,
              })),
            ]
            if (pool.length === 0) continue
            const pick = pool[Math.floor(Math.random() * pool.length)]

            // Enqueue via send route (server-to-server with service-role bearer)
            const sendRes = await fetch(new URL('/lovable/email/transactional/send', request.url).toString(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                templateName: 'daily-reminder',
                recipientEmail: email,
                idempotencyKey: `daily-${p.user_id}-${(p as any).last_sent_on ? '' : ''}${todayUtc}`,
                templateData: {
                  itemName: pick.name,
                  detail: pick.detail,
                  category: pick.category,
                  isCustom: pick.isCustom,
                },
              }),
            })
            if (!sendRes.ok) {
              failed++
              continue
            }
            await supabase
              .from('email_preferences')
              .update({ last_sent_on: todayUtc })
              .eq('user_id', p.user_id)
            sent++
          } catch (e) {
            console.error('daily reminder failed for user', p.user_id, e)
            failed++
          }
        }

        return Response.json({ ok: true, considered: prefs?.length ?? 0, due: dueUsers.length, sent, failed })
      },
    },
  },
})
