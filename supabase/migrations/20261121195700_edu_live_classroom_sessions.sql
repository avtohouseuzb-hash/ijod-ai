-- IJOD EDU Live Classroom — Step 1: persistent lesson sessions.
-- This migration is committed to an isolated feature branch only.
-- It is not applied to the production Supabase database by this change.

create table if not exists public.edu_live_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grade smallint not null check (grade between 1 and 11),
  subject text not null check (char_length(subject) between 2 and 80),
  topic text not null default '' check (char_length(topic) <= 240),
  mode text not null default 'guided'
    check (mode in ('guided', 'voice')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint edu_live_sessions_end_after_start
    check (ended_at is null or ended_at >= started_at),
  constraint edu_live_sessions_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists edu_live_sessions_user_started_idx
  on public.edu_live_sessions (user_id, started_at desc);

create index if not exists edu_live_sessions_user_status_idx
  on public.edu_live_sessions (user_id, status, updated_at desc);

create table if not exists public.edu_live_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.edu_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  role text not null check (role in ('student', 'tutor', 'system')),
  modality text not null default 'text'
    check (modality in ('text', 'audio', 'image', 'multimodal')),
  content text not null default ''
    check (char_length(content) <= 12000),
  lesson_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(lesson_payload) = 'object'),
  source_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_refs) = 'array'),
  created_at timestamptz not null default now(),
  constraint edu_live_turns_session_sequence_unique
    unique (session_id, sequence)
);

create index if not exists edu_live_turns_session_created_idx
  on public.edu_live_turns (session_id, sequence);

create index if not exists edu_live_turns_user_created_idx
  on public.edu_live_turns (user_id, created_at desc);

create table if not exists public.edu_live_whiteboard_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.edu_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_id uuid
    references public.edu_live_turns(id) on delete set null,
  sequence bigint generated always as identity,
  command jsonb not null
    check (jsonb_typeof(command) = 'object'),
  playback_ms integer not null default 0
    check (playback_ms between 0 and 3600000),
  created_at timestamptz not null default now(),
  constraint edu_live_whiteboard_sequence_unique
    unique (session_id, sequence)
);

create index if not exists edu_live_whiteboard_session_sequence_idx
  on public.edu_live_whiteboard_events (session_id, sequence);

-- Students can read only their own lesson data.
-- Writes are performed by authenticated server routes using the service role.
alter table public.edu_live_sessions enable row level security;
alter table public.edu_live_turns enable row level security;
alter table public.edu_live_whiteboard_events enable row level security;

revoke all on public.edu_live_sessions from anon, authenticated;
revoke all on public.edu_live_turns from anon, authenticated;
revoke all on public.edu_live_whiteboard_events from anon, authenticated;

grant select on public.edu_live_sessions to authenticated;
grant select on public.edu_live_turns to authenticated;
grant select on public.edu_live_whiteboard_events to authenticated;

grant all on public.edu_live_sessions to service_role;
grant all on public.edu_live_turns to service_role;
grant all on public.edu_live_whiteboard_events to service_role;

drop policy if exists "Students read own live sessions"
  on public.edu_live_sessions;
create policy "Students read own live sessions"
  on public.edu_live_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Students read own live turns"
  on public.edu_live_turns;
create policy "Students read own live turns"
  on public.edu_live_turns
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Students read own whiteboard events"
  on public.edu_live_whiteboard_events;
create policy "Students read own whiteboard events"
  on public.edu_live_whiteboard_events
  for select to authenticated
  using ((select auth.uid()) = user_id);
