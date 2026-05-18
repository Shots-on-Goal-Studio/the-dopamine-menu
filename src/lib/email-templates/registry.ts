import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as welcomeTemplate } from './welcome'
import { template as dailyReminderTemplate } from './daily-reminder'

export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome: welcomeTemplate,
  'daily-reminder': dailyReminderTemplate,
}
