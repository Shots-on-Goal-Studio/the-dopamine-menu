ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS extra_reminder_hours smallint[] NOT NULL DEFAULT '{}'::smallint[],
  ADD COLUMN IF NOT EXISTS last_sent_hours jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.email_preferences
  DROP CONSTRAINT IF EXISTS email_preferences_extra_reminder_hours_len;

ALTER TABLE public.email_preferences
  ADD CONSTRAINT email_preferences_extra_reminder_hours_len
  CHECK (coalesce(array_length(extra_reminder_hours, 1), 0) <= 3);