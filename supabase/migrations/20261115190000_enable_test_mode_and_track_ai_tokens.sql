-- Temporary IJOD AI testing mode: keep user credit balances unchanged.
-- Also record provider-reported token usage per AI model call.
-- Disable the mode later with:
-- update public.ai_runtime_settings set credit_test_mode = false, updated_at = now() where id = true;

create table if not exists public.ai_runtime_settings (
  id boolean primary key default true check (id = true),
  credit_test_mode boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.ai_runtime_settings (id, credit_test_mode)
values (true, true)
on conflict (id) do nothing;

alter table public.ai_runtime_settings enable row level security;
revoke all on public.ai_runtime_settings from anon, authenticated;
grant all on public.ai_runtime_settings to service_role;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid,
  feature text not null,
  model text not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  usage_available boolean not null default false,
  raw_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists ai_usage_events_feature_created_idx
  on public.ai_usage_events (feature, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from anon, authenticated;
grant all on public.ai_usage_events to service_role;

comment on table public.ai_usage_events is
  'Provider-reported AI token usage. Requests without token usage are stored with usage_available=false and NULL token counts.';

create or replace function public.reserve_credit_for_user(p_user_id uuid, p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_existing_balance integer;
  v_test_mode boolean := false;
begin
  if p_user_id is null then
    raise exception 'User id required';
  end if;
  if p_request_id is null then
    raise exception 'Request id required';
  end if;

  select coalesce(s.credit_test_mode, false)
    into v_test_mode
  from public.ai_runtime_settings s
  where s.id = true;

  if coalesce(v_test_mode, false) then
    select p.credits into v_balance
    from public.profiles p
    where p.user_id = p_user_id;

    if v_balance is null then
      raise exception 'Profile not found';
    end if;

    return v_balance;
  end if;

  -- Repeating the same request ID must never charge twice.
  select t.balance_after into v_existing_balance
  from public.credit_transactions t
  where t.user_id = p_user_id
    and t.request_id = p_request_id
    and t.amount = -1
    and t.refund_of_transaction_id is null
  limit 1;

  if v_existing_balance is not null then
    return v_existing_balance;
  end if;

  update public.profiles
  set credits = credits - 1, updated_at = now()
  where user_id = p_user_id and credits > 0
  returning credits into v_balance;

  if v_balance is null then
    if not exists (select 1 from public.profiles p where p.user_id = p_user_id) then
      raise exception 'Profile not found';
    end if;
    raise exception 'Insufficient credits';
  end if;

  insert into public.credit_transactions
    (user_id, amount, reason, balance_after, request_id)
  values
    (p_user_id, -1, 'ai_text_generation', v_balance, p_request_id);

  return v_balance;
end;
$$;

create or replace function public.reserve_credits_for_user(
  p_user_id uuid,
  p_request_id uuid,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_existing integer;
  v_test_mode boolean := false;
begin
  if p_user_id is null or p_request_id is null or p_amount < 1 or p_amount > 20 then
    raise exception 'Invalid credit reservation';
  end if;

  select coalesce(s.credit_test_mode, false)
    into v_test_mode
  from public.ai_runtime_settings s
  where s.id = true;

  if coalesce(v_test_mode, false) then
    select p.credits into v_balance
    from public.profiles p
    where p.user_id = p_user_id;

    if v_balance is null then
      raise exception 'Profile not found';
    end if;

    return v_balance;
  end if;

  select t.balance_after into v_existing
  from public.credit_transactions t
  where t.user_id = p_user_id
    and t.request_id = p_request_id
    and t.amount = -p_amount
    and t.refund_of_transaction_id is null
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  update public.profiles
  set credits = credits - p_amount, updated_at = now()
  where user_id = p_user_id and credits >= p_amount
  returning credits into v_balance;

  if v_balance is null then
    if not exists (select 1 from public.profiles where user_id = p_user_id) then
      raise exception 'Profile not found';
    end if;
    raise exception 'Insufficient credits';
  end if;

  insert into public.credit_transactions (user_id, amount, reason, balance_after, request_id)
  values (p_user_id, -p_amount, 'ai_product_card_generation', v_balance, p_request_id);

  return v_balance;
end;
$$;

create or replace function public.refund_credit(
  p_user_id uuid,
  p_request_id uuid,
  p_reason text default 'ai_generation_failed'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debit_id bigint;
  v_balance integer;
  v_existing_refund boolean;
  v_test_mode boolean := false;
begin
  if p_user_id is null or p_request_id is null then
    raise exception 'User id and request id required';
  end if;

  select coalesce(s.credit_test_mode, false)
    into v_test_mode
  from public.ai_runtime_settings s
  where s.id = true;

  if coalesce(v_test_mode, false) then
    select p.credits into v_balance
    from public.profiles p
    where p.user_id = p_user_id;

    if v_balance is null then
      raise exception 'Profile not found';
    end if;

    return v_balance;
  end if;

  select t.id into v_debit_id
  from public.credit_transactions t
  where t.user_id = p_user_id
    and t.request_id = p_request_id
    and t.amount = -1
    and t.refund_of_transaction_id is null
  limit 1;

  if v_debit_id is null then
    raise exception 'Matching debit transaction not found';
  end if;

  select exists (
    select 1 from public.credit_transactions t
    where t.refund_of_transaction_id = v_debit_id
  ) into v_existing_refund;

  if v_existing_refund then
    select p.credits into v_balance
    from public.profiles p where p.user_id = p_user_id;
    return v_balance;
  end if;

  update public.profiles
  set credits = credits + 1, updated_at = now()
  where user_id = p_user_id
  returning credits into v_balance;

  if v_balance is null then
    raise exception 'Profile not found';
  end if;

  insert into public.credit_transactions
    (user_id, amount, reason, balance_after, refund_of_transaction_id)
  values
    (p_user_id, 1, left(coalesce(nullif(p_reason, ''), 'ai_generation_failed'), 80),
     v_balance, v_debit_id);

  return v_balance;
end;
$$;

create or replace function public.refund_credits_for_user(
  p_user_id uuid,
  p_request_id uuid,
  p_reason text default 'ai_product_card_failed'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debit_id bigint;
  v_amount integer;
  v_balance integer;
  v_test_mode boolean := false;
begin
  if p_user_id is null or p_request_id is null then
    raise exception 'User id and request id required';
  end if;

  select coalesce(s.credit_test_mode, false)
    into v_test_mode
  from public.ai_runtime_settings s
  where s.id = true;

  if coalesce(v_test_mode, false) then
    select p.credits into v_balance
    from public.profiles p
    where p.user_id = p_user_id;

    if v_balance is null then
      raise exception 'Profile not found';
    end if;

    return v_balance;
  end if;

  select t.id, -t.amount into v_debit_id, v_amount
  from public.credit_transactions t
  where t.user_id = p_user_id
    and t.request_id = p_request_id
    and t.amount < 0
    and t.refund_of_transaction_id is null
  order by t.id desc
  limit 1;

  if v_debit_id is null then
    raise exception 'Matching debit transaction not found';
  end if;

  if exists (
    select 1 from public.credit_transactions
    where refund_of_transaction_id = v_debit_id
  ) then
    select p.credits into v_balance
    from public.profiles p
    where p.user_id = p_user_id;
    return v_balance;
  end if;

  update public.profiles
  set credits = credits + v_amount, updated_at = now()
  where user_id = p_user_id
  returning credits into v_balance;

  if v_balance is null then
    raise exception 'Profile not found';
  end if;

  insert into public.credit_transactions
    (user_id, amount, reason, balance_after, refund_of_transaction_id)
  values
    (p_user_id, v_amount, left(coalesce(nullif(p_reason, ''), 'ai_product_card_failed'), 80),
     v_balance, v_debit_id);

  return v_balance;
end;
$$;
