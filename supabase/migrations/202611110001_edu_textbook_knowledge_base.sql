-- IJOD EDU textbook knowledge base
-- PDF originals live in a private Supabase Storage bucket. OpenAI File Search indexes
-- the same files so the tutor can retrieve textbook passages by grade and subject.

create table if not exists public.edu_textbook_settings (
  id boolean primary key default true check (id = true),
  openai_vector_store_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.edu_textbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  grade integer not null check (grade between 1 and 11),
  subject text not null,
  language text not null default 'uz-Latn',
  edition text,
  publisher text,
  storage_path text not null unique,
  openai_file_id text,
  vector_store_id text,
  status text not null default 'upload_pending'
    check (status in ('upload_pending', 'uploaded', 'indexing', 'ready', 'failed')),
  error_message text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists edu_textbooks_lookup_idx
  on public.edu_textbooks (grade, subject, status, created_at desc);

alter table public.edu_textbook_settings enable row level security;
alter table public.edu_textbooks enable row level security;

revoke all on public.edu_textbook_settings from anon, authenticated;
revoke all on public.edu_textbooks from anon, authenticated;
grant select on public.edu_textbooks to authenticated;

drop policy if exists "Students can view indexed textbooks" on public.edu_textbooks;
create policy "Students can view indexed textbooks"
  on public.edu_textbooks for select to authenticated
  using (status = 'ready');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('edu-textbooks', 'edu-textbooks', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array['application/pdf'];

-- All writes use the service role from authenticated server routes.
