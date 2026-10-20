create table if not exists public.dashboard_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null,
  updated_at timestamptz not null default now(),
  constraint dashboard_layouts_is_array check (jsonb_typeof(layout) = 'array')
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint calendar_events_valid_range check (ends_at > starts_at)
);

alter table public.google_calendar_connections
  drop constraint if exists google_calendar_connections_scope_check;
alter table public.google_calendar_connections
  add constraint google_calendar_connections_scope_check
  check (scope in (
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/calendar.events.owned'
  ));

create index if not exists calendar_events_user_start_idx
  on public.calendar_events(user_id, starts_at);

alter table public.dashboard_layouts enable row level security;
alter table public.calendar_events enable row level security;

create policy dashboard_layouts_select_self on public.dashboard_layouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy dashboard_layouts_insert_self on public.dashboard_layouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy dashboard_layouts_update_self on public.dashboard_layouts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy calendar_events_select_self on public.calendar_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy calendar_events_insert_self on public.calendar_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy calendar_events_update_self on public.calendar_events
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy calendar_events_delete_self on public.calendar_events
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.dashboard_layouts, public.calendar_events from anon;
grant select, insert, update on public.dashboard_layouts to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
