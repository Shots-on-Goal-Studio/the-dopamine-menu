import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const sendWelcomeEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ timezone: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: identity, error: identityError } = await supabase.auth.getUser()
    if (identityError || identity.user?.id !== userId || !identity.user.email) throw new Error('Unauthorized')
    const { data: preferences, error } = await supabase.from('email_preferences')
      .select('welcome_sent_at').eq('user_id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    if (preferences?.welcome_sent_at) return { alreadySent: true }
    const { sendRecordedEmail } = await import('./send-recorded.server')
    const result = await sendRecordedEmail('welcome', identity.user.email, { idempotencyKey: `welcome-${userId}` })
    // Suppression is terminal for this welcome, not a reason to retry on every login.
    const { error: writeError } = await supabase.from('email_preferences').upsert({
      user_id: userId, welcome_sent_at: new Date().toISOString(), timezone: data.timezone,
    }, { onConflict: 'user_id' })
    if (writeError) throw new Error(writeError.message)
    return { alreadySent: false, ...result }
  })