-- IJOD EDU Live Classroom foundation.
-- Feature branch only; do not apply to production until review and tests pass.

create table if not exists public.edu_live_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grade smallint not null check (grade between 1 and 11),
  subject text not null check (char_length(subject) between 2 and 80),
  topic text not null default '' check (char_length(topic) <= 240),
  mode text not null default 'guided' check (mode in ('guided', 'voice')),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint edu_live_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);
create index if not exists edu_live_sessions_user_started_idx on public.edu_live_sessions(user_id, started_at desc);
create index if not exists edu_live_sessions_user_active_idx on public.edu_live_sessions(user_id, status) where status='active';

create table if not exists public.edu_live_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.edu_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  role text not null check (role in ('student', 'tutor', 'system')),
  modality text not null default 'text' check (modality in ('text', 'audio', 'image', 'multimodal')),
  content text not null default '' check (char_length(content) <= 12000),
  lesson_payload jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint edu_live_turns_session_sequence_unique unique(session_id, sequence)
);
create index if not exists edu_live_turns_session_sequence_idx on public.edu_live_turns(session_id, sequence);

create table if not exists public.edu_live_whiteboard_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.edu_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_id uuid references public.edu_live_turns(id) on delete set null,
  sequence bigint generated always as identity,
  command jsonb not null,
  playback_ms integer not null default 0 check (playback_ms between 0 and 3600000),
  created_at timestamptz not null default now(),
  constraint edu_live_whiteboard_events_sequence_unique unique(session_id, sequence)
);
create index if not exists edu_live_whiteboard_session_sequence_idx on public.edu_live_whiteboard_events(session_id, sequence);

create table if not exists public.edu_live_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.edu_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_id uuid references public.edu_live_turns(id) on delete set null,
  question_key text not null check (char_length(question_key) between 1 and 120),
  answer_payload jsonb not null default '{}'::jsonb,
  is_correct boolean,
  score numeric(5,2) check (score is null or score between 0 and 100),
  feedback text not null default '' check (char_length(feedback) <= 2000),
  attempt_number smallint not null default 1 check (attempt_number between 1 and 50),
  created_at timestamptz not null default now()
);
create index if not exists edu_live_quiz_attempts_user_created_idx on public.edu_live_quiz_attempts(user_id, created_at desc);
create index if not exists edu_live_quiz_attempts_session_idx on public.edu_live_quiz_attempts(session_id, created_at);

create table if not exists public.edu_live_assets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.edu_live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  asset_type text not null check (asset_type in ('student_image', 'whiteboard_snapshot', 'lesson_attachment')),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists edu_live_assets_session_idx on public.edu_live_assets(session_id, created_at);

create table if not exists public.edu_live_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grade smallint not null check (grade between 1 and 11),
  subject text not null check (char_length(subject) between 2 and 80),
  topic text not null check (char_length(topic) between 1 and 240),
  mastery_score numeric(5,2) not null default 0 check (mastery_score between 0 and 100),
  total_attempts integer not null default 0 check (total_attempts >= 0),
  correct_attempts integer not null default 0 check (correct_attempts between 0 and total_attempts),
  last_studied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edu_live_progress_user_topic_unique unique(user_id, grade, subject, topic)
);
create index if not exists edu_live_progress_user_subject_idx on public.edu_live_progress(user_id, subject, last_studied_at desc);

alter table public.ai_usage_events
  add column if not exists session_id uuid references public.edu_live_sessions(id) on delete set null,
  add column if not exists modality text not null default 'text',
  add column if not exists input_audio_tokens integer,
  add column if not exists output_audio_tokens integer,
  add column if not exists input_image_tokens integer,
  add column if not exists cached_input_tokens integer,
  add column if not exists session_duration_ms integer;
create index if not exists ai_usage_events_session_created_idx on public.ai_usage_events(session_id, created_at desc) where session_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='ai_usage_events_modality_check') then
    alter table public.ai_usage_events add constraint ai_usage_events_modality_check check (modality in ('text','audio','image','multimodal'));
  end if;
  if not exists (select 1 from pg_constraint where conname='ai_usage_events_audio_tokens_check') then
    alter table public.ai_usage_events add constraint ai_usage_events_audio_tokens_check check (
      (input_audio_tokens is null or input_audio_tokens >= 0) and (output_audio_tokens is null or output_audio_tokens >= 0));
  end if;
  if not exists (select 1 from pg_constraint where conname='ai_usage_events_image_tokens_check') then
    alter table public.ai_usage_events add constraint ai_usage_events_image_tokens_check check (input_image_tokens is null or input_image_tokens >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='ai_usage_events_cached_tokens_check') then
    alter table public.ai_usage_events add constraint ai_usage_events_cached_tokens_check check (cached_input_tokens is null or cached_input_tokens >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='ai_usage_events_session_duration_check') then
    alter table public.ai_usage_events add constraint ai_usage_events_session_duration_check check (session_duration_ms is null or session_duration_ms between 0 and 86400000);
  end if;
end $$;

alter table public.edu_live_sessions enable row level security;
alter table public.edu_live_turns enable row level security;
alter table public.edu_live_whiteboard_events enable row level security;
alter table public.edu_live_quiz_attempts enable row level security;
alter table public.edu_live_assets enable row level security;
alter table public.edu_live_progress enable row level security;

revoke all on public.edu_live_sessions from anon, authenticated;
revoke all on public.edu_live_turns from anon, authenticated;
revoke all on public.edu_live_whiteboard_events from anon, authenticated;
revoke all on public.edu_live_quiz_attempts from anon, authenticated;
revoke all on public.edu_live_assets from anon, authenticated;
revoke all on public.edu_live_progress from anon, authenticated;
grant select, insert on public.edu_live_sessions to authenticated;
grant update(status, ended_at, updated_at) on public.edu_live_sessions to authenticated;
grant select on public.edu_live_turns to authenticated;
grant select on public.edu_live_whiteboard_events to authenticated;
grant select on public.edu_live_quiz_attempts to authenticated;
grant select, insert on public.edu_live_assets to authenticated;
grant select on public.edu_live_progress to authenticated;

drop policy if exists "Students read own live sessions" on public.edu_live_sessions;
create policy "Students read own live sessions" on public.edu_live_sessions for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Students create own live sessions" on public.edu_live_sessions;
create policy "Students create own live sessions" on public.edu_live_sessions for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Students update own live sessions" on public.edu_live_sessions;
create policy "Students update own live sessions" on public.edu_live_sessions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

drop policy if exists "Students read own live turns" on public.edu_live_turns;
create policy "Students read own live turns" on public.edu_live_turns for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Students read own whiteboard events" on public.edu_live_whiteboard_events;
create policy "Students read own whiteboard events" on public.edu_live_whiteboard_events for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Students read own quiz attempts" on public.edu_live_quiz_attempts;
create policy "Students read own quiz attempts" on public.edu_live_quiz_attempts for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Students read own live assets" on public.edu_live_assets;
create policy "Students read own live assets" on public.edu_live_assets for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Students add own live assets" on public.edu_live_assets;
create policy "Students add own live assets" on public.edu_live_assets for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Students read own live progress" on public.edu_live_progress;
create policy "Students read own live progress" on public.edu_live_progress for select to authenticated using ((select auth.uid())=user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('edu-live-assets','edu-live-assets',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Students read own live assets" on storage.objects;
create policy "Students read own live assets" on storage.objects for select to authenticated
  using (bucket_id='edu-live-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Students upload own live assets" on storage.objects;
create policy "Students upload own live assets" on storage.objects for insert to authenticated
  with check (bucket_id='edu-live-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Students delete own live assets" on storage.objects;
create policy "Students delete own live assets" on storage.objects for delete to authenticated
  using (bucket_id='edu-live-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
