create table if not exists public.ai_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  service text not null check (char_length(service) between 1 and 100),
  result_text text,
  asset_url text,
  prompt text,
  rating smallint check (rating between 1 and 5),
  rating_note text check (rating_note is null or char_length(rating_note) <= 500),
  task_outcome text check (
    task_outcome is null or task_outcome in ('completed', 'partial', 'failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_projects_user_created_idx
  on public.ai_projects (user_id, created_at desc);

alter table public.ai_projects enable row level security;

drop policy if exists "Users can read their own AI projects" on public.ai_projects;
create policy "Users can read their own AI projects"
  on public.ai_projects for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update feedback on their own AI projects" on public.ai_projects;
create policy "Users can update feedback on their own AI projects"
  on public.ai_projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.ai_projects to authenticated;
grant update (rating, rating_note, task_outcome, updated_at) on public.ai_projects to authenticated;
