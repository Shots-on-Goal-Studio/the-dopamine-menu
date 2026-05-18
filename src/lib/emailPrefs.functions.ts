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
      .select('daily_reminder,timezone,welcome_sent_at,reminder_hour')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return data
    // Insert default row (trigger should have created it, but be defensive)
    const { data: created, error: insErr } = await supabase
      .from('email_preferences')
      .insert({ user_id: userId })
      .select('daily_reminder,timezone,welcome_sent_at,reminder_hour')
      .single()
    if (insErr) throw new Error(insErr.message)
    return created
  })

// Update the daily-reminder toggle and timezone.
export const setEmailPreferences = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dailyReminder: z.boolean(),
        timezone: z.string().min(1).max(80),
        reminderHour: z.number().int().min(0).max(23).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const patch: Record<string, unknown> = {
      user_id: userId,
      daily_reminder: data.dailyReminder,
      timezone: data.timezone,
    }
    if (typeof data.reminderHour === 'number') patch.reminder_hour = data.reminderHour
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
    // Only set welcome_sent_at if it's null (idempotent).
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
