-- Run after creating and confirming this Auth user in the Supabase dashboard.
-- Set the password and authenticator privately; this file contains no credentials.
begin;
do $$
begin
  if not exists (select 1 from auth.users where lower(email) = 'nabinkunwar992@gmail.com' and email_confirmed_at is not null) then
    raise exception 'Create and confirm the admin Auth user nabinkunwar992@gmail.com first.';
  end if;
end;
$$;
insert into public.admin_members(user_id)
select id from auth.users where lower(email) = 'nabinkunwar992@gmail.com'
on conflict (user_id) do nothing;
commit;
