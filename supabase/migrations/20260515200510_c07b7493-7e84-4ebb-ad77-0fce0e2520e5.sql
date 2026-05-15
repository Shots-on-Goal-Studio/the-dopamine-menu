
-- Category enum
do $$ begin
  create type public.dopamine_category as enum ('quick','medium','big');
exception when duplicate_object then null; end $$;

-- custom_hits
create table public.custom_hits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  detail text,
  category public.dopamine_category not null,
  created_at timestamptz not null default now()
);
alter table public.custom_hits enable row level security;

create policy "custom_hits_select_own" on public.custom_hits
  for select using (auth.uid() = user_id);
create policy "custom_hits_insert_own" on public.custom_hits
  for insert with check (auth.uid() = user_id);
create policy "custom_hits_delete_own" on public.custom_hits
  for delete using (auth.uid() = user_id);

create index custom_hits_user_cat_idx on public.custom_hits(user_id, category, created_at desc);

-- dopamine_logs
create table public.dopamine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  category public.dopamine_category not null,
  is_custom boolean not null default false,
  streak_at_time integer not null default 0,
  logged_at timestamptz not null default now()
);
alter table public.dopamine_logs enable row level security;

create policy "dopamine_logs_select_own" on public.dopamine_logs
  for select using (auth.uid() = user_id);
create policy "dopamine_logs_insert_own" on public.dopamine_logs
  for insert with check (auth.uid() = user_id);
create policy "dopamine_logs_delete_own" on public.dopamine_logs
  for delete using (auth.uid() = user_id);

create index dopamine_logs_user_logged_idx on public.dopamine_logs(user_id, logged_at desc);
