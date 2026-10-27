-- Persistent IJOD AI projects and user feedback
create table if not exists public.ai_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  service text not null,
  result_text text,
  asset_url text,
  prompt text,
  rating smallint check (rating between 1 and 5),
  rating_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_projects_user_created_idx on public.ai_projects(user_id, created_at desc);
alter table public.ai_projects enable row level security;
drop policy if exists "Users read own AI projects" on public.ai_projects;
create policy "Users read own AI projects" on public.ai_projects for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users update own AI project ratings" on public.ai_projects;
create policy "Users update own AI project ratings" on public.ai_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.ai_projects from anon, authenticated;
grant select, update on public.ai_projects to authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-project-assets', 'ai-project-assets', true, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
