-- Support the full official school subject catalogue and multipart textbooks.
alter table public.edu_textbooks
  add column if not exists part text;

update storage.buckets
set file_size_limit = 157286400
where id = 'edu-textbooks';

create table if not exists public.edu_textbook_collections (
  grade integer not null check (grade between 1 and 11),
  subject text not null,
  openai_vector_store_id text not null,
  updated_at timestamptz not null default now(),
  primary key (grade, subject)
);
alter table public.edu_textbook_collections enable row level security;
revoke all on public.edu_textbook_collections from anon, authenticated;
