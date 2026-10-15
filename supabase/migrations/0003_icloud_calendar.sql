create table if not exists public.icloud_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  feed_url_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.icloud_calendar_connections enable row level security;
revoke all on public.icloud_calendar_connections from public, anon, authenticated;
alter table public.life_items add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high'));
