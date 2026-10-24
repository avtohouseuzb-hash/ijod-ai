-- IJOD AI credit system
-- New accounts receive 10 starter credits. One successful AI text request costs 1 credit.
-- Run once in Supabase; this schema was applied to the connected project on 2026-10-24.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  credits integer not null default 10 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_created_idx
  on public.credit_transactions (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own credit transactions" on public.credit_transactions;
create policy "Users can read own credit transactions"
  on public.credit_transactions for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
revoke all on public.credit_transactions from anon, authenticated;
grant select on public.credit_transactions to authenticated;
revoke all on sequence public.credit_transactions_id_seq from anon, authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, credits)
  values (new.id, new.email, 10)
  on conflict (user_id) do nothing;

  if not exists (
    select 1 from public.credit_transactions
    where user_id = new.id and reason = 'welcome_bonus'
  ) then
    insert into public.credit_transactions (user_id, amount, reason)
    values (new.id, 10, 'welcome_bonus');
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

insert into public.profiles (user_id, email, credits)
select u.id, u.email, 10
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.reserve_credit()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  update public.profiles
    set credits = credits - 1,
        updated_at = now()
    where user_id = v_user_id and credits > 0
    returning credits into v_balance;

  if v_balance is null then
    raise exception 'Insufficient credits' using errcode = 'P0001';
  end if;

  insert into public.credit_transactions (user_id, amount, reason)
    values (v_user_id, -1, 'ai_text_generation');

  return v_balance;
end;
$$;

revoke all on function public.reserve_credit() from public, anon;
grant execute on function public.reserve_credit() to authenticated;

create or replace function public.refund_credit(p_user_id uuid, p_reason text default 'ai_text_failed')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := current_setting('request.jwt.claim.role', true);
  v_balance integer;
begin
  if v_role is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  update public.profiles
    set credits = credits + 1,
        updated_at = now()
    where user_id = p_user_id
    returning credits into v_balance;

  if v_balance is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  insert into public.credit_transactions (user_id, amount, reason)
    values (p_user_id, 1, left(p_reason, 80));

  return v_balance;
end;
$$;

revoke all on function public.refund_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_credit(uuid, text) to service_role;
