-- Installed as a migration. Only an allowlisted AAL2 owner may configure this.
-- The deploy hook is entered privately in Studio, never in this SQL file.
create extension if not exists pg_net with schema extensions;

create or replace function public.configure_portfolio_publishing(p_deploy_hook text,p_function_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text; v_value text; v_id uuid; v_secret text;
begin
  if public.is_portfolio_admin() is distinct from true then raise exception 'Verify your administrator second factor.';end if;
  if p_deploy_hook is null or p_deploy_hook !~ '^https://api\.cloudflare\.com/client/v4/pages/webhooks/deploy_hooks/[A-Za-z0-9_-]{8,200}$' then
    raise exception 'Use the Cloudflare Pages deploy hook URL for your production branch.';
  end if;
  if p_function_url is null or p_function_url !~ '^https://[a-z0-9]{20}\.supabase\.co/functions/v1/request-publish$' then
    raise exception 'The publishing function URL is invalid.';
  end if;
  perform pg_advisory_xact_lock(73104646);
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='portfolio_publish_secret';
  if v_secret is null or length(v_secret)<32 then v_secret:=encode(extensions.gen_random_bytes(32),'hex');end if;
  for v_name,v_value in select * from (values
    ('portfolio_deploy_hook',p_deploy_hook),
    ('portfolio_publish_url',p_function_url),
    ('portfolio_publish_secret',v_secret)
  ) as config(name,value) loop
    select id into v_id from vault.secrets where name=v_name;
    if v_id is null then perform vault.create_secret(v_value,v_name,'Private portfolio publishing configuration');
    else perform vault.update_secret(v_id,v_value,v_name,'Private portfolio publishing configuration');end if;
  end loop;
  update public.publishing_status set state='pending',last_error=null where id=1;
  return jsonb_build_object('configured',true);
end;
$$;
revoke all on function public.configure_portfolio_publishing(text,text) from public,anon;
grant execute on function public.configure_portfolio_publishing(text,text) to authenticated;

-- Only server code may retrieve the hook or the narrowly scoped webhook secret.
create or replace function public.get_portfolio_publish_config()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'deploy_hook',(select decrypted_secret from vault.decrypted_secrets where name='portfolio_deploy_hook'),
    'webhook_secret',(select decrypted_secret from vault.decrypted_secrets where name='portfolio_publish_secret')
  );
$$;
revoke all on function public.get_portfolio_publish_config() from public,anon,authenticated;
grant execute on function public.get_portfolio_publish_config() to service_role;

create or replace function private.dispatch_portfolio_publish() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='portfolio_publish_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='portfolio_publish_secret';
  if v_url is null or v_secret is null then return new;end if;
  perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-publish-secret',v_secret),body:=jsonb_build_object('event_id',new.id),timeout_milliseconds:=15000);
  return new;
exception when others then
  update public.publishing_status set last_error='The automatic publish notification failed. Your content is saved; retry from Publishing.' where id=1;
  return new;
end;
$$;
revoke all on function private.dispatch_portfolio_publish() from public,anon,authenticated;
drop trigger if exists portfolio_publish_webhook on private.publish_queue;
create trigger portfolio_publish_webhook after insert on private.publish_queue
for each row execute function private.dispatch_portfolio_publish();
