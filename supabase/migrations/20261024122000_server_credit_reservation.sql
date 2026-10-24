-- Server-only atomic credit reservation.
-- Run against the Supabase project once; this migration has already been applied.

create or replace function public.reserve_credit_for_user(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  if p_user_id is null then
    raise exception 'User id required' using errcode = '22004';
  end if;

  update public.profiles
    set credits = credits - 1,
        updated_at = now()
    where user_id = p_user_id and credits > 0
    returning credits into v_balance;

  if v_balance is null then
    if not exists (select 1 from public.profiles where user_id = p_user_id) then
      raise exception 'Profile not found' using errcode = 'P0002';
    end if;
    raise exception 'Insufficient credits' using errcode = 'P0001';
  end if;

  insert into public.credit_transactions (user_id, amount, reason)
    values (p_user_id, -1, 'ai_text_generation');

  return v_balance;
end;
$$;

revoke all on function public.reserve_credit_for_user(uuid) from public, anon, authenticated;
grant execute on function public.reserve_credit_for_user(uuid) to service_role;
