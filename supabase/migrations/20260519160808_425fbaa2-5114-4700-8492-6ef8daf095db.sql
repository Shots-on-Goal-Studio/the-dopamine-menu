
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Bootstrap brian@shotsongoal.io as admin (no-op if user doesn't exist)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE email = 'brian@shotsongoal.io'
ON CONFLICT DO NOTHING;

-- Events
CREATE TYPE public.app_event_type AS ENUM (
  'roll_clicked',
  'menu_item_clicked',
  'menu_item_logged'
);

CREATE TABLE public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type public.app_event_type NOT NULL,
  metadata jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_events_type_time ON public.app_events (event_type, occurred_at DESC);
CREATE INDEX idx_app_events_time ON public.app_events (occurred_at DESC);
CREATE INDEX idx_app_events_user ON public.app_events (user_id, occurred_at DESC);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own events"
  ON public.app_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all events"
  ON public.app_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
