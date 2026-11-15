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
  select *
  into v_code
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

  insert into public.edu_parent_student_links(
    parent_user_id,
    student_user_id,
    status,
    requested_at,
    approved_at
  )
  values (
    p_parent_user_id,
    v_code.student_user_id,
    'pending',
    now(),
    null
  )
  on conflict on constraint edu_parent_student_links_pair_unique
  do update set
    status = 'pending',
    requested_at = now(),
    approved_at = null
  returning public.edu_parent_student_links.id into v_link_id;

  update public.edu_student_link_codes
  set used_at = now()
  where id = v_code.id;

  return query select v_link_id, v_code.student_user_id;
end;
$$;

revoke all on function public.redeem_edu_student_link_code(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_edu_student_link_code(text, uuid) to service_role;
