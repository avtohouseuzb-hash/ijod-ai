-- Idempotent credit reservations and one-time refunds.
-- Existing transaction rows and columns are preserved.
alter table public.credit_transactions
  add column if not exists request_id uuid,
  add column if not exists refund_of_transaction_id bigint;

create unique index if not exists credit_transactions_user_request_uidx
  on public.credit_transactions (user_id, request_id)
  where request_id is not null;

create unique index if not exists credit_transactions_refund_once_uidx
  on public.credit_transactions (refund_of_transaction_id)
  where refund_of_transaction_id is not null;

create or replace function public.reserve_credit_for_user(
  p_user_id uuid,
  p_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_balance integer;
  v_existing_balance integer;
begin
  if p_user_id is null then
    raise exception 'User id required';
  end if;
  if p_request_id is null then
    raise exception 'Request id required';
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
$function$;

create or replace function public.refund_credit(
  p_user_id uuid,
  p_request_id uuid,
  p_reason text default 'ai_generation_failed'
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text := current_setting('request.jwt.claim.role', true);
  v_debit_id bigint;
  v_balance integer;
  v_existing_refund boolean;
begin
  if v_role is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_user_id is null or p_request_id is null then
    raise exception 'User id and request id required';
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

  -- Unique index on refund_of_transaction_id makes a second refund impossible.
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
$function$;

revoke all on function public.reserve_credit_for_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_credit_for_user(uuid, uuid) to service_role;
revoke all on function public.refund_credit(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.refund_credit(uuid, uuid, text) to service_role;
