CREATE TABLE public.balloon_pop_counters (
  user_id UUID NOT NULL PRIMARY KEY,
  total BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.balloon_pop_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balloon_pop_counters_select_own"
  ON public.balloon_pop_counters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "balloon_pop_counters_insert_own"
  ON public.balloon_pop_counters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "balloon_pop_counters_update_own"
  ON public.balloon_pop_counters FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);