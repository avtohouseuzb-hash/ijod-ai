create table if not exists public.edu_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'parent')),
  display_name text not null check (char_length(display_name) between 2 and 100),
  grade smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint edu_user_roles_grade_check check (
    (role = 'student' and grade between 1 and 11) or
    (role = 'parent' and grade is null)
  )
);

create table if not exists public.edu_student_link_codes (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists edu_student_link_codes_student_idx
  on public.edu_student_link_codes(student_user_id, created_at desc);

create table if not exists public.edu_parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint edu_parent_student_links_not_self check (parent_user_id <> student_user_id),
  constraint edu_parent_student_links_pair_unique unique(parent_user_id, student_user_id)
);

create index if not exists edu_parent_student_links_parent_idx
  on public.edu_parent_student_links(parent_user_id, status);
create index if not exists edu_parent_student_links_student_idx
  on public.edu_parent_student_links(student_user_id, status);

alter table public.edu_user_roles enable row level security;
alter table public.edu_student_link_codes enable row level security;
alter table public.edu_parent_student_links enable row level security;

drop policy if exists "Users can read own EDU role" on public.edu_user_roles;
create policy "Users can read own EDU role"
  on public.edu_user_roles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own EDU role" on public.edu_user_roles;
create policy "Users can create own EDU role"
  on public.edu_user_roles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own EDU role" on public.edu_user_roles;
create policy "Users can update own EDU role"
  on public.edu_user_roles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.redeem_edu_student_link_code(p_code_hash text, p_parent_user_id uuid)
returns table(link_id uuid, student_user_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_code public.edu_student_link_codes%rowtype;
  v_link_id uuid;
begin
  select * into v_code
  from public.edu_student_link_codes
  where code_hash = p_code_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired link code';
  end if;

  if v_code.student_user_id = p_parent_user_id then
    raise exception 'Cannot link account to itself';
  end if;

  insert into public.edu_parent_student_links(parent_user_id, student_user_id, status, requested_at, approved_at)
  values (p_parent_user_id, v_code.student_user_id, 'pending', now(), null)
  on conflict (parent_user_id, student_user_id)
  do update set status = 'pending', requested_at = now(), approved_at = null
  returning id into v_link_id;

  update public.edu_student_link_codes
  set used_at = now()
  where id = v_code.id;

  return query select v_link_id, v_code.student_user_id;
end;
$$;

revoke all on function public.redeem_edu_student_link_code(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_edu_student_link_code(text, uuid) to service_role;
