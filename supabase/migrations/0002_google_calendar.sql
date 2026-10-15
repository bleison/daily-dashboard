create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_encrypted text not null,
  scope text not null check (scope = 'https://www.googleapis.com/auth/calendar.events.readonly'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.google_calendar_connections enable row level security;
revoke all on public.google_calendar_connections from public, anon, authenticated;
-- Access is restricted to server routes using the Supabase service role. Each query binds user_id to auth.uid() from the verified session.
