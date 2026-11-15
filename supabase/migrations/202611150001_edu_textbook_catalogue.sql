-- Support the full official school subject catalogue and multipart textbooks.
alter table public.edu_textbooks
  add column if not exists part text;

update storage.buckets
set file_size_limit = 157286400
where id = 'edu-textbooks';
