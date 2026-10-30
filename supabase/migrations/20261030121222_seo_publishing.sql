alter table public.content_items add column first_published_at timestamptz;
alter table public.content_items add column content_modified_at timestamptz;

-- Sample templates must not become public articles or enter generated feeds.
update public.content_items set is_published=false where kind='post' and data->>'sample'='true';

-- Preserve a genuine pre-migration publication date; never use migration/build time.
create function private.article_date(value text) returns timestamptz language plpgsql immutable set search_path='' as $$
declare parsed timestamptz;
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}(T[0-9:.]+(Z|[+-][0-9:]+))?$' then return null;end if;
  parsed:=(case when length(value)=10 then value||'T00:00:00Z' else value end)::timestamptz;
  return parsed;
exception when others then return null;
end;
$$;
update public.content_items set first_published_at=private.article_date(data->>'date')
where kind='post' and is_published and private.article_date(data->>'date')<=now();

create table public.site_routes (
  source_path text primary key check(source_path ~ '^/blog/[a-z0-9]+(-[a-z0-9]+)*/$'),
  target_path text check(target_path is null or target_path ~ '^/blog/[a-z0-9]+(-[a-z0-9]+)*/$'),
  status integer not null check(status in (301,410)),
  record_id text not null,
  changed_at timestamptz not null default now(),
  check((status=301 and target_path is not null and source_path<>target_path) or (status=410 and target_path is null))
);
alter table public.site_routes enable row level security;
revoke all on public.site_routes from anon,authenticated;
grant select(source_path,target_path,status) on public.site_routes to anon;
grant select on public.site_routes to authenticated;
grant all on public.site_routes to service_role;
create policy "Route history can be read for static generation" on public.site_routes for select to anon,authenticated using(true);

create table private.publish_queue (
  id bigint generated always as identity primary key,
  record_id text not null,
  action text not null,
  status text not null default 'pending' check(status in ('pending','dispatching','requested','failed')),
  batch_id uuid,
  attempts integer not null default 0,
  requested_at timestamptz,
  created_at timestamptz not null default now()
);
alter table private.publish_queue enable row level security;
revoke all on private.publish_queue from public,anon,authenticated;
create table public.publishing_status (
  id integer primary key default 1 check(id=1),
  state text not null default 'not_configured',
  pending_count integer not null default 0,
  last_requested_at timestamptz,
  last_error text
);
insert into public.publishing_status(id) values(1);
alter table public.publishing_status enable row level security;
revoke all on public.publishing_status from anon,authenticated;
grant select on public.publishing_status to authenticated;
grant all on public.publishing_status to service_role;
create policy "MFA admins can read publishing status" on public.publishing_status for select to authenticated using((select public.is_portfolio_admin()));

create function private.post_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
declare v_material boolean;
declare v_reserved text;
begin
  if new.kind<>'post' then return new; end if;
  if new.slug in ('category','tag','page','search','feed') then raise exception 'This slug is reserved for the blog'; end if;
  if tg_op='UPDATE' then
    new.first_published_at:=old.first_published_at;
    new.content_modified_at:=old.content_modified_at;
    if old.slug<>new.slug then
      select record_id into v_reserved from public.site_routes where source_path='/blog/'||new.slug||'/';
      if v_reserved is not null and v_reserved<>new.id then raise exception 'This slug belongs to a historical article URL'; end if;
    end if;
    v_material:=old.title is distinct from new.title or
      (old.data->'body') is distinct from (new.data->'body') or
      (old.data->'excerpt') is distinct from (new.data->'excerpt') or
      (old.data->'imageUrl') is distinct from (new.data->'imageUrl') or
      (old.data->'imageAlt') is distinct from (new.data->'imageAlt') or
      (old.data->'sources') is distinct from (new.data->'sources') or
      (old.data->'relatedProjectSlugs') is distinct from (new.data->'relatedProjectSlugs');
    if old.first_published_at is not null and v_material then new.content_modified_at:=now(); end if;
  else
    new.first_published_at:=null;new.content_modified_at:=null;
    select record_id into v_reserved from public.site_routes where source_path='/blog/'||new.slug||'/';
    if v_reserved is not null then raise exception 'This slug belongs to a historical article URL'; end if;
  end if;
  if new.is_published then
    if new.data->>'sample'='true' then raise exception 'Replace the sample article before publishing'; end if;
    if length(trim(coalesce(new.slug,'')))=0 or length(new.slug)>100 then raise exception 'A readable article slug is required'; end if;
    if length(trim(coalesce(new.data->>'body','')))=0 then raise exception 'Article content is required'; end if;
    if length(trim(coalesce(new.data->>'metaDescription','')))=0 then raise exception 'A meta description is required'; end if;
    if length(trim(coalesce(new.data->>'imageUrl','')))=0 or length(trim(coalesce(new.data->>'imageAlt','')))=0 then raise exception 'A featured image and descriptive alt text are required'; end if;
    if new.first_published_at is null then
      if tg_op='UPDATE' and old.is_published then
        new.first_published_at:=private.article_date(new.data->>'date');
        if new.first_published_at is null or new.first_published_at>now() then
          raise exception 'Enter the genuine original publication date for this existing article';
        end if;
        if v_material then new.content_modified_at:=now();end if;
      else
        new.first_published_at:=now();new.content_modified_at:=new.first_published_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger content_seo_lifecycle before insert or update on public.content_items for each row execute function private.post_lifecycle();
create unique index unique_published_seo_title on public.content_items(lower(trim(coalesce(nullif(trim(data->>'seoTitle'),''),title)))) where kind='post' and is_published;
create unique index unique_published_meta_description on public.content_items(lower(trim(data->>'metaDescription'))) where kind='post' and is_published;

create function private.track_public_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_id text;
declare v_publish boolean;
declare v_path text;
begin
  v_id:=coalesce(new.id,old.id);
  if tg_op='DELETE' then
    v_publish:=old.is_published or old.first_published_at is not null;
    if old.kind='post' and old.first_published_at is not null then
      v_path:='/blog/'||old.slug||'/';
      update public.site_routes set status=410,target_path=null,changed_at=now() where record_id=old.id;
      insert into public.site_routes(source_path,target_path,status,record_id) values(v_path,null,410,old.id)
      on conflict(source_path) do update set target_path=null,status=410,changed_at=now();
    end if;
  else
    v_publish:=new.is_published or (tg_op='UPDATE' and old.is_published);
    if tg_op='UPDATE' and new.kind='post' and old.first_published_at is not null and old.slug<>new.slug then
      delete from public.site_routes where source_path='/blog/'||new.slug||'/' and record_id=new.id;
      update public.site_routes set target_path='/blog/'||new.slug||'/',status=301,changed_at=now() where record_id=new.id;
      insert into public.site_routes(source_path,target_path,status,record_id) values('/blog/'||old.slug||'/','/blog/'||new.slug||'/',301,new.id)
      on conflict(source_path) do update set target_path=excluded.target_path,status=301,changed_at=now();
    end if;
  end if;
  if v_publish then
    insert into private.publish_queue(record_id,action) values(v_id,lower(tg_op));
    update public.publishing_status set state='pending',pending_count=(select count(*) from private.publish_queue where status in ('pending','failed')) where id=1;
  end if;
  if tg_op='DELETE' then return old;end if;return new;
end;
$$;
create trigger content_publication_queue after insert or update or delete on public.content_items for each row execute function private.track_public_change();

create function public.claim_publish_batch() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_batch uuid:=gen_random_uuid();
declare v_count integer;
begin
  -- Recover abandoned dispatches without losing pending edits.
  update private.publish_queue set status='failed' where status='dispatching' and requested_at<now()-interval '2 minutes';
  with candidates as(select id from private.publish_queue where status in ('pending','failed') order by id for update skip locked limit 100)
  update private.publish_queue set status='dispatching',batch_id=v_batch,attempts=attempts+1,requested_at=now() where id in(select id from candidates);
  get diagnostics v_count=row_count;
  return jsonb_build_object('batch_id',v_batch,'count',v_count);
end;
$$;
create function public.finish_publish_batch(p_batch uuid,p_success boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  update private.publish_queue set status=case when p_success then 'requested' else 'failed' end where batch_id=p_batch and status='dispatching';
  update public.publishing_status set state=case when p_success then 'requested' else 'failed' end,
    pending_count=(select count(*) from private.publish_queue where status in ('pending','failed')),
    last_requested_at=case when p_success then now() else last_requested_at end,
    last_error=case when p_success then null else 'The build hook did not accept this request. Check server configuration and retry.' end where id=1;
end;
$$;
revoke all on function public.claim_publish_batch() from public,anon,authenticated;
revoke all on function public.finish_publish_batch(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_publish_batch(),public.finish_publish_batch(uuid,boolean) to service_role;
