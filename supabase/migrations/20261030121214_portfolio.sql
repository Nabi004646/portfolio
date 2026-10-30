-- Run once in your Supabase SQL editor, or apply with `supabase db push`.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_members enable row level security;
revoke all on public.admin_members from anon, authenticated;
grant select on public.admin_members to authenticated;
create policy "Only read your own allowlist membership" on public.admin_members
  for select to authenticated using (user_id = (select auth.uid()));
-- No browser insert/update/delete policies; only the database owner adds admins.

create function public.is_portfolio_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
    and exists (select 1 from public.admin_members where user_id = (select auth.uid()));
$$;
revoke all on function public.is_portfolio_admin() from public, anon;
grant execute on function public.is_portfolio_admin() to authenticated;

create table public.content_items (
  id text primary key check (length(id) between 1 and 120),
  kind text not null check (kind in ('settings', 'home', 'about', 'skills', 'contact', 'page', 'project', 'post')),
  title text not null check (length(title) between 1 and 180),
  slug text not null default '' check (slug = '' or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_published boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 99999),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and octet_length(data::text) < 512000),
  updated_at timestamptz not null default now()
);
create unique index content_unique_slug on public.content_items(kind, slug) where slug <> '';
alter table public.content_items enable row level security;
revoke all on public.content_items from anon, authenticated;
grant select on public.content_items to anon;
grant select, insert, update, delete on public.content_items to authenticated;
create policy "Published content is readable" on public.content_items
  for select to anon, authenticated using (is_published);
create policy "MFA admins can read drafts" on public.content_items
  for select to authenticated using ((select public.is_portfolio_admin()));
create policy "MFA admins can create content" on public.content_items
  for insert to authenticated with check ((select public.is_portfolio_admin()));
create policy "MFA admins can edit content" on public.content_items
  for update to authenticated using ((select public.is_portfolio_admin())) with check ((select public.is_portfolio_admin()));
create policy "MFA admins can remove content" on public.content_items
  for delete to authenticated using ((select public.is_portfolio_admin()));

create table public.submissions (
  id uuid primary key,
  kind text not null check (kind in ('contact', 'visit')),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  name text,
  email text,
  subject text,
  message text,
  file_path text,
  file_name text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  accuracy double precision check (accuracy >= 0 and accuracy <= 10000000),
  consent_version text not null,
  consent_at timestamptz not null,
  consent_text text not null,
  email_status text not null default 'pending' check (email_status in ('pending', 'accepted', 'failed')),
  email_id text,
  created_at timestamptz not null default now(),
  constraint visit_requires_consent_data check (kind <> 'visit' or (latitude is not null and longitude is not null and accuracy is not null and file_path is not null)),
  constraint contact_requires_message check (kind <> 'contact' or (name is not null and email is not null and message is not null))
);
create index submissions_by_kind_time on public.submissions(kind, created_at desc);
alter table public.submissions enable row level security;
revoke all on public.submissions from anon, authenticated;
grant select, delete on public.submissions to authenticated;
create policy "MFA admins can read submissions" on public.submissions
  for select to authenticated using ((select public.is_portfolio_admin()));
create policy "MFA admins can delete submissions" on public.submissions
  for delete to authenticated using ((select public.is_portfolio_admin()));
-- Public writes and email-status updates only occur inside the Edge Functions.

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  record_id text not null,
  created_at timestamptz not null default now()
);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
create policy "MFA admins can read audit events" on public.audit_events
  for select to authenticated using ((select public.is_portfolio_admin()));

create function private.record_content_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor_id, action, record_id)
  values ((select auth.uid()), tg_table_name || ':' || lower(tg_op), coalesce(new.id, old.id)::text);
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger content_change_audit before insert or update or delete on public.content_items
  for each row execute function private.record_content_change();

create function private.record_submission_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor_id, action, record_id)
  values ((select auth.uid()), 'submissions:delete', old.id::text);
  return old;
end;
$$;
create trigger submission_delete_audit after delete on public.submissions
  for each row execute function private.record_submission_delete();

create table private.portfolio_rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (key, window_start)
);
alter table private.portfolio_rate_limits enable row level security;
revoke all on private.portfolio_rate_limits from public, anon, authenticated;
create function public.portfolio_take_rate_limit(p_key text, p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
declare v_window timestamptz := date_bin('10 minutes', now(), '2000-01-01'::timestamptz);
begin
  if length(p_key) <> 64 or p_limit < 1 or p_limit > 200 then raise exception 'Invalid rate limit'; end if;
  delete from private.portfolio_rate_limits where window_start < now() - interval '1 hour';
  insert into private.portfolio_rate_limits(key, window_start, hits) values(p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = private.portfolio_rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.portfolio_take_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.portfolio_take_rate_limit(text, integer) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('portfolio-media', 'portfolio-media', true, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('portfolio-private', 'portfolio-private', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "MFA admins can list media" on storage.objects for select to authenticated
  using (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()));
create policy "MFA admins can upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()));
create policy "MFA admins can replace media" on storage.objects for update to authenticated
  using (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()))
  with check (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()));
create policy "MFA admins can delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-media' and (select public.is_portfolio_admin()));
create policy "MFA admins can view private files" on storage.objects for select to authenticated
  using (bucket_id = 'portfolio-private' and (select public.is_portfolio_admin()));
create policy "MFA admins can delete private files" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio-private' and (select public.is_portfolio_admin()));
-- No anonymous Storage writes, no public private-file reads, no browser role changes.

grant all on public.admin_members, public.content_items, public.submissions, public.audit_events to service_role;
grant usage, select on sequence public.audit_events_id_seq to service_role;
