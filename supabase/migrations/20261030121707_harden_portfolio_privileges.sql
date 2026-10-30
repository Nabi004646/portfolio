-- Keep the platform's RLS event trigger off the public RPC surface.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end $$;
-- Preserve the same rows while avoiding two permissive SELECT policies per role.
alter policy "Published content is readable" on public.content_items to anon;
alter policy "MFA admins can read drafts" on public.content_items to authenticated
  using (is_published or (select public.is_portfolio_admin()));
