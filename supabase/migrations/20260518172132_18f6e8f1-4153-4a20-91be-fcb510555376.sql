ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS reminder_hour smallint NOT NULL DEFAULT 9
  CHECK (reminder_hour BETWEEN 0 AND 23);