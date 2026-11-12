create table if not exists public.edu_study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  subject text not null check (char_length(subject) between 2 and 80),
  grade smallint not null check (grade between 1 and 11),
  starts_at timestamptz not null,
  duration_minutes smallint not null default 30 check (duration_minutes between 5 and 300),
  notes text not null default '' check (char_length(notes) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists edu_study_plans_user_starts_idx on public.edu_study_plans(user_id, starts_at);
alter table public.edu_study_plans enable row level security;
grant select, insert, update, delete on public.edu_study_plans to authenticated;
drop policy if exists "Students read own study plans" on public.edu_study_plans;
create policy "Students read own study plans" on public.edu_study_plans for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Students create own study plans" on public.edu_study_plans;
create policy "Students create own study plans" on public.edu_study_plans for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Students update own study plans" on public.edu_study_plans;
create policy "Students update own study plans" on public.edu_study_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Students delete own study plans" on public.edu_study_plans;
create policy "Students delete own study plans" on public.edu_study_plans for delete to authenticated using ((select auth.uid()) = user_id);
