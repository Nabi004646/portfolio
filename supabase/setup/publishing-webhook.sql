-- Run after the migrations, in your own Supabase SQL editor. Set the two Vault
-- secrets using the dashboard BEFORE installing this trigger:
-- portfolio_publish_url = https://PROJECT.supabase.co/functions/v1/request-publish
-- portfolio_publish_secret = the same random value as PUBLISH_WEBHOOK_SECRET
-- Never use a service-role key as the webhook secret.
create extension if not exists pg_net with schema extensions;
create function private.dispatch_portfolio_publish() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_url text;
declare v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='portfolio_publish_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='portfolio_publish_secret' limit 1;
  if v_url is null or v_secret is null then return new;end if;
  perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-publish-secret',v_secret),body:=jsonb_build_object('event_id',new.id),timeout_milliseconds:=30000);
  return new;
end;
$$;
create trigger portfolio_publish_webhook after insert on private.publish_queue
for each row execute function private.dispatch_portfolio_publish();
