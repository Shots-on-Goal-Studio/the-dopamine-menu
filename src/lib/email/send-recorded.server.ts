import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTemplateEmail, type SendTemplateEmailOptions } from '@/lib/email-templates/send-email'

// Audit failures must not change the actual send outcome.
export async function sendRecordedEmail(templateName: string, recipient: string, options: SendTemplateEmailOptions) {
  const writeLog = async (status: 'sent' | 'suppressed' | 'failed', errorMessage?: string) => {
    const { error } = await supabaseAdmin.from('email_send_log').insert({
      message_id: options.idempotencyKey ?? null,
      template_name: templateName,
      recipient_email: recipient,
      status,
      error_message: errorMessage?.slice(0, 1000) ?? null,
    })
    if (error) console.error('Email audit write failed', { code: error.code, message: error.message })
  }
  let result: Awaited<ReturnType<typeof sendTemplateEmail>>
  try {
    result = await sendTemplateEmail(templateName, recipient, options)
  } catch (error) {
    await writeLog('failed', error instanceof Error ? error.message : String(error))
    throw error
  }
  await writeLog(result.sent ? 'sent' : 'suppressed')
  return result
}