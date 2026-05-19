import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// Get current user's email preferences (auto-creates if missing).
export const getEmailPreferences = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const { data, error } = await supabase
      .from('email_preferences')
      .select('daily_reminder,timezone,welcome_sent_at,reminder_hour,extra_reminder_hours')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return data
    const { data: created, error: insErr } = await supabase
      .from('email_preferences')
      .insert({ user_id: userId })
      .select('daily_reminder,timezone,welcome_sent_at,reminder_hour,extra_reminder_hours')
      .single()
    if (insErr) {
      if ((insErr as { code?: string }).code === '23503') {
        return {
          daily_reminder: true,
          timezone: 'UTC',
          welcome_sent_at: null,
          reminder_hour: 9,
          extra_reminder_hours: [] as number[],
        }
      }
      throw new Error(insErr.message)
    }
    return created
  })

// Update the daily-reminder toggle, timezone, hour, and extra reminder hours.
export const setEmailPreferences = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dailyReminder: z.boolean(),
        timezone: z.string().min(1).max(80),
        reminderHour: z.number().int().min(0).max(23).optional(),
        extraReminderHours: z
          .array(z.number().int().min(0).max(23))
          .max(3)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const patch: {
      user_id: string
      daily_reminder: boolean
      timezone: string
      reminder_hour?: number
      extra_reminder_hours?: number[]
    } = {
      user_id: userId,
      daily_reminder: data.dailyReminder,
      timezone: data.timezone,
    }
    if (typeof data.reminderHour === 'number') patch.reminder_hour = data.reminderHour
    if (Array.isArray(data.extraReminderHours)) {
      const baseHour = data.reminderHour
      const cleaned = Array.from(new Set(data.extraReminderHours))
        .filter((h) => typeof baseHour !== 'number' || h !== baseHour)
        .sort((a, b) => a - b)
        .slice(0, 3)
      patch.extra_reminder_hours = cleaned
    }
    const { error } = await supabase
      .from('email_preferences')
      .upsert(patch, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// Mark welcome as sent (called after the client successfully enqueues it).
export const markWelcomeSent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ timezone: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: row } = await supabase
      .from('email_preferences')
      .select('welcome_sent_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (row?.welcome_sent_at) return { alreadySent: true }
    const { error } = await supabase
      .from('email_preferences')
      .update({ welcome_sent_at: new Date().toISOString(), timezone: data.timezone })
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
    return { alreadySent: false }
  })
