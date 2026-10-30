-- Fresh portfolio installation for project xgtqpixoutlhqhflkpqs.
-- Run ONCE in Supabase SQL Editor. Existing installations use migrations.
-- This guarded transaction creates portfolio objects and published starter copy.
-- It does not create an Auth user, set a password, or contain secret keys.
begin;
do $$ begin
  if to_regclass('public.content_items') is not null then
    raise exception 'Portfolio tables already exist. Use unapplied migrations instead of this fresh installer.';
  end if;
end $$;

-- 20261030121214_portfolio.sql
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


-- 20261030121218_certificates.sql
-- Apply after 20261030121214_portfolio.sql, including on existing projects.
alter table public.content_items drop constraint if exists content_items_kind_check;
alter table public.content_items add constraint content_items_kind_check
  check (kind in ('settings', 'home', 'about', 'skills', 'contact', 'page', 'project', 'post', 'certificate'));
-- Certificates inherit the existing published-read / allowlisted-AAL2-write
-- policies and content audit trigger. No public write access is introduced.


-- 20261030121222_seo_publishing.sql
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


-- 20261030121225_contacts_and_intro.sql
-- User-supplied public profiles; preserve other settings and additional profiles.
update public.content_items c set data =
  '{"introEnabled":true,"introTitle":"NABI","introCaption":"Curiosity. Craft. A little fire.","introReplayLabel":"Replay intro"}'::jsonb
  || c.data
  || jsonb_build_object(
    'facebook','https://www.facebook.com/nabie.webdev',
    'github','https://github.com/Nabi004646',
    'socialLinks',
      coalesce((select jsonb_agg(link) from jsonb_array_elements(coalesce(c.data->'socialLinks','[]'::jsonb)) link
        where lower(coalesce(link->>'label','')) not in ('facebook','github')
          and coalesce(link->>'url','') not in ('https://www.facebook.com/nabie.webdev','https://github.com/Nabi004646')),'[]'::jsonb)
      || '[{"label":"Facebook","icon":"facebook","url":"https://www.facebook.com/nabie.webdev"},{"label":"GitHub","icon":"github","url":"https://github.com/Nabi004646"}]'::jsonb,
    'personalLinks',
      '[{"label":"Facebook","handle":"@nabie.webdev","icon":"facebook","url":"https://www.facebook.com/nabie.webdev"},{"label":"GitHub","handle":"@Nabi004646","icon":"github","url":"https://github.com/Nabi004646"}]'::jsonb
      || coalesce((select jsonb_agg(link) from jsonb_array_elements(coalesce(c.data->'personalLinks','[]'::jsonb)) link
        where lower(coalesce(link->>'label','')) not in ('facebook','github')
          and coalesce(link->>'url','') not in ('https://www.facebook.com/nabie.webdev','https://github.com/Nabi004646')),'[]'::jsonb)
  )
where c.id='settings';


-- 20261030121707_harden_portfolio_privileges.sql
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

-- Initial content; does not overwrite rows.
-- Generated from src/content.js. Seed once; this never overwrites existing edits.
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('ui-copy','settings','Page headings & interface copy','',true,5,'{"projects":{"eyebrow":"IDEAS, MADE REAL","headline":"A few things\nI’ve been building.","intro":"A collection of personal projects, experiments, and things I’m learning by doing."},"blog":{"eyebrow":"NOTES FROM THE JOURNEY","headline":"Learning.\nThinking. Sharing.","intro":"A growing notebook on development, projects, and the questions that keep me curious."},"about":{"principlesHeading":"A few things I believe.","journeyEyebrow":"AN ONGOING JOURNEY","journeyHeading":"Always a\nwork in progress.","resumeLabel":"Download résumé"},"cta":{"eyebrow":"YOUR NEXT IDEA STARTS HERE","button":"Let’s make it happen","sideNote":"SAY HELLO. MAKE SOMETHING."},"contact":{"nameLabel":"Your name","namePlaceholder":"What should I call you?","emailLabel":"Email address","subjectLabel":"What’s it about?","subjects":["A project idea","A collaboration","A learning opportunity","Just saying hello"],"messageLabel":"Your message","messagePlaceholder":"A little context goes a long way…","attachmentLabel":"Add a brief or reference","footnote":"Your attachment is private. No mailing lists.","faqEyebrow":"A LITTLE MORE CONTEXT","faqTitle":"Good questions.","locationLabel":"BASED IN","availabilityLabel":"LET’S CONNECT","decoration":"GOOD IDEAS\nWELCOME HERE."},"lab":{"eyebrow":"INTERACTIVE COLLEGE PROJECT","headline":"Camera &\nlocation lab.","intro":"A small experiment in camera access, local face detection, and geolocation. It’s a browser API demo, not identity verification.","button":"Open the demo","illustration":"YOUR CHOICE.\nYOUR CAMERA.\nONE FRAME."}}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('seo-settings','settings','SEO & author profile','',true,9,'{"siteName":"Nabin Kunwar","titleSuffix":"Nabin Kunwar","blogTitle":"Development & security notes","blogDescription":"Practical notes on web development, Linux, cybersecurity learning, and projects by Nabin Kunwar.","authorSlug":"nabin-kunwar","authorBio":"Nabin Kunwar is a web developer and cybersecurity student in Nepal, with interests in Android development, robotics, neuroscience, and biology.","authorDescription":"About Nabin Kunwar, a web developer and cybersecurity student based in Nepal.","defaultSocialAlt":"Nabin Kunwar — web development and cybersecurity learning notes","twitterHandle":"","archivePageSize":6,"enableLlmsTxt":false}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('certificates-settings','settings','Certificate section & carousel','',true,6,'{"eyebrow":"LEARNING, WITH A LITTLE PROOF","title":"Milestones along\nthe way.","intro":"Certificates from courses and workshops in my learning journey.","pageHeadline":"Always learning.\nHere’s the journey.","allLabel":"All certificates","viewLabel":"View certificate","verifyLabel":"View credential","previousLabel":"Previous certificate","nextLabel":"Next certificate","pauseLabel":"Pause carousel","playLabel":"Play carousel","closeLabel":"Close certificate","autoplay":true,"intervalSeconds":5}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('layout','settings','Section layout & visibility','',true,7,'{"homeSections":[{"section":"hero","visible":true},{"section":"ribbon","visible":true},{"section":"projects","visible":true},{"section":"about","visible":true},{"section":"services","visible":true},{"section":"skills","visible":true},{"section":"certificates","visible":true},{"section":"blog","visible":true},{"section":"contact","visible":true}],"showCertificatesOnAbout":true}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('detail-copy','settings','Buttons, captions & decorative copy','',true,8,'{"header":{"cta":"Let’s talk","themeLabel":"Switch color theme","menuLabel":"Open navigation"},"footer":{"privacy":"Privacy","terms":"Terms","studio":"Studio","links":[]},"home":{"onlineLabel":"Available online","yearLabel":"PORTFOLIO","projectsLink":"All projects","aboutLink":"A little more about me","blogLink":"All notes","servicesCaption":"THINK. BUILD. IMPROVE.","monogram":"NK","sticker":"A CURIOUS\nHUMAN BEHIND\nTHE SCREEN. ↗","artCaption":"BUILT IN NEPAL. OPEN TO THE WORLD.","featuredProjectsOnly":true,"maxProjects":2,"maxArticles":3},"heroArt":{"fileName":"hello_world.js","name":"Nabin","building":"what’s next","status":"Always learning","securityTitle":"Built with care","securityText":"Security in mind.","floatingText":"Make something good.","caption":"AN EXPLORER’S WORK IN PROGRESS"},"projectArt":{"hostname":"nepocore.com","brandFirst":"nepo","brandSecond":"core.","headline":"Your everyday digital toolkit.","tools":["Image tools","PDF tools","Dev tools"],"search":"Find your next useful tool","sticker":"Made to be useful ✳","labLabel":"Camera + location","studioLetter":"N","studioCaption":"IDEAS INTO\nINTERFACES.","studioNote":"Let’s make\nit happen."},"articleArt":{"curiosityCaption":"STAY CURIOUS.","interfaceCaption":"Good design feels simple. ↗","securityCaption":"BUILD WITH CARE."},"projects":{"allFilter":"All projects","featuredFilter":"Selected work","empty":"More projects are on the way.","back":"← All projects","detailEyebrow":"THE PROJECT","visit":"Explore project","source":"View source"},"blog":{"allFilter":"All notes","search":"Find a note…","empty":"No notes match that search. Try another word.","back":"← All notes","sample":"Sample article","sampleDetail":"Sample article · editable in Studio","authorInitial":"N","thanks":"Thanks for reading.","conversation":"Continue the conversation"},"general":{"backHome":"← Back home","detailsEyebrow":"THE DETAILS","notFoundEyebrow":"A LITTLE OFF THE PATH","notFoundTitle":"This page isn’t here.","notFoundText":"There’s still plenty to explore.","homeButton":"Back to home","pauseMotion":"Pause motion","motionPaused":"Motion paused"}}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('settings','settings','Site settings','',true,0,'{"name":"Nabin Kunwar","brand":"Nabin","role":"Developer & security explorer","location":"Kathmandu, Nepal","email":"nabinkunwar992@gmail.com","github":"https://github.com/Nabi004646","facebook":"https://www.facebook.com/nabie.webdev","linkedin":"https://www.linkedin.com/in/nabin-kunwar-332551356/","instagram":"https://www.instagram.com/nabin.webdev/","socialLinks":[{"label":"Facebook","icon":"facebook","url":"https://www.facebook.com/nabie.webdev"},{"label":"GitHub","icon":"github","url":"https://github.com/Nabi004646"},{"label":"LinkedIn","icon":"linkedin","url":"https://www.linkedin.com/in/nabin-kunwar-332551356/"},{"label":"Instagram","icon":"external","url":"https://www.instagram.com/nabin.webdev/"}],"personalLinks":[{"label":"Facebook","handle":"@nabie.webdev","icon":"facebook","url":"https://www.facebook.com/nabie.webdev"},{"label":"GitHub","handle":"@Nabi004646","icon":"github","url":"https://github.com/Nabi004646"}],"introEnabled":true,"introTitle":"NABI","introCaption":"Curiosity. Craft. A little fire.","introReplayLabel":"Replay intro","resumeUrl":"","portraitUrl":"","availability":"Open to ideas & collaborations","footerLine":"A little curiosity. A lot of care.","footerNote":"Designed with intention. Built in Nepal.","metaDescription":"Nabin Kunwar — web developer and cybersecurity student. Projects, experiments, and notes from Nepal.","cream":"#f5f3ee","blue":"#3156eb","coral":"#ff916c","demoEnabled":true,"demoRecipientLabel":"Nabin Kunwar (portfolio owner)","nav":[{"label":"Home","href":"/"},{"label":"About","href":"/about"},{"label":"Projects","href":"/projects"},{"label":"Certificates","href":"/certificates"},{"label":"Blog","href":"/blog"},{"label":"Contact","href":"/contact"}]}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('home','home','Home','',true,1,'{"eyebrow":"DEVELOPER. LEARNER. BUILDER.","greeting":"Hey, I’m Nabin","headline":"I build for the web.","accentLine":"And think beyond it.","intro":"A web developer and cybersecurity student turning curiosity into thoughtful digital experiences. Based in Nepal. Building for everywhere.","primaryCta":"Explore my work","secondaryCta":"Let’s talk","sideLabel":"IDEAS INTO INTERFACES","scrollLabel":"A little more about me","workEyebrow":"SELECTED WORK","workTitle":"Built with curiosity.","workDescription":"A few projects where ideas become something you can actually use.","aboutEyebrow":"THE PERSON BEHIND THE PIXELS","aboutTitle":"Curious by nature.\nA builder by choice.","aboutText":"I’m Nabin, or Nabi for short. I enjoy connecting design and development, then asking how to make what I build safer. My interests stretch from cybersecurity to robotics, neuroscience, and biology.","blogEyebrow":"NOTES FROM THE JOURNEY","blogTitle":"Learning out loud.","contactTitle":"Have something\nin mind?","contactText":"An idea, a question, or just a hello. My inbox is a good place to start.","chips":["Web development","Cybersecurity","Always curious"],"serviceTitle":"What I bring to the table.","services":[{"icon":"code","title":"Thoughtful development","description":"Responsive websites and interfaces built around the people who use them."},{"icon":"layers","title":"Design that feels right","description":"Clear layouts, small details, and interactions that make the web a little nicer."},{"icon":"shield","title":"A security mindset","description":"Learning how systems work, how they fail, and how to build with more care."}]}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('about','about','About me','about',true,2,'{"eyebrow":"A LITTLE ABOUT ME","headline":"More than a\nline of code.","intro":"I’m Nabin Kunwar, a web developer and cybersecurity student from Nepal. I like making useful things and understanding what happens beneath the surface.","story":"I started with the building blocks of the web: HTML, CSS, and JavaScript. That grew into an interest in full-stack development, WordPress, and the details that turn a page into an experience.\n\nNow I’m also learning cybersecurity. For me, building and understanding security belong together. I use Linux, keep experimenting, and learn best by making something real.\n\nOutside the browser, I’m curious about neuroscience, robotics, and biology. Android development is also on my learning horizon.","principles":[{"title":"Keep asking why.","description":"The interesting part usually starts one question deeper."},{"title":"Make it useful.","description":"Good work makes someone’s day a little easier."},{"title":"Build with care.","description":"Accessibility, privacy, and the small details all count."}],"journey":[{"label":"Building foundations","title":"Web development","description":"HTML, CSS, JavaScript, and responsive interfaces."},{"label":"Making things real","title":"Personal projects","description":"Exploring WordPress, full-stack workflows, and Nepocore."},{"label":"Learning now","title":"Cybersecurity","description":"Linux, web security fundamentals, and hands-on practice."},{"label":"On the horizon","title":"Android development","description":"An interest in Kotlin, mobile experiences, and what comes next."}]}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('skills','skills','Skills & toolkit','',true,3,'{"eyebrow":"MY EVERYDAY TOOLKIT","title":"Different tools.\nOne curious mind.","groups":[{"title":"Web & interfaces","items":["HTML","CSS","JavaScript","React","Responsive design"]},{"title":"Building & shipping","items":["Node.js","MySQL","WordPress","Git","Cloudflare"]},{"title":"Exploring next","items":["Cybersecurity","Linux","Supabase","Kotlin","Android"]}]}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('contact','contact','Contact','contact',true,4,'{"eyebrow":"LET’S MAKE SOMETHING","headline":"Good things start\nwith a hello.","intro":"Tell me what you have in mind. A project, a collaboration, or a question — I’d like to hear it.","formTitle":"A note to Nabin","submitLabel":"Send your message","attachmentHelp":"A brief or a reference? Attach a PDF, JPG, PNG, or WebP. Up to 5 MB.","successTitle":"Your note is in.","successText":"Thanks for reaching out. I’ll read your message and get back to you.","faqs":[{"question":"What can I contact you about?","answer":"Web projects, collaborations, learning opportunities, or a thoughtful question. Share enough context to help me understand your idea."},{"question":"Can I include a project brief?","answer":"Yes. Add a PDF or an image to the contact form. Attachments are private and available only to the portfolio administrator."},{"question":"Where are you based?","answer":"I’m based in Nepal and happy to connect online."}]}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('project:nepocore','project','Nepocore','nepocore',true,10,'{"category":"WEB DEVELOPMENT","summary":"Useful tools. One simple place.","description":"My personal project exploring a home for free online tools and downloadable resources.","body":"Nepocore is a personal web project built around useful digital tools. The aim is a clear interface where people can find a tool and get on with their task.\n\nWorking on it has been a way to practice responsive layouts, deployment, and improving the details of a real site.","tags":["Web tools","Responsive UI","Personal project"],"url":"https://nepocore.com","github":"","imageUrl":"","visual":"tools","color":"blue","year":"Personal project","featured":true}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('project:portfolio-studio','project','Portfolio Studio','portfolio-studio',true,11,'{"category":"DESIGN & DEVELOPMENT","summary":"A space that feels like me.","description":"This portfolio brings soft clay forms, glass surfaces, and subtle parallax together with an editable content studio.","body":"A personal home for my work, interests, and learning notes. This project uses a static frontend designed for Cloudflare Pages and a Supabase backend for content, files, and administrator authentication.\n\nThe interface explores depth through clay-inspired shapes and glass, with reduced-motion support and layouts for small screens.","tags":["Supabase","Cloudflare Pages","Content studio"],"url":"","github":"","imageUrl":"","visual":"studio","color":"peach","year":"Portfolio project","featured":true}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('project:consent-lab','project','Camera & Location Lab','consent-lab',true,12,'{"category":"INTERACTIVE EXPERIMENT","summary":"An experiment in browser APIs.","description":"A disclosed camera and location demo with local face detection, a visible countdown, and consent before capture.","body":"A college-project experiment with browser camera access, local face detection, and geolocation. Participants first see what will be collected and where it will be sent.\n\nAfter consent and browser permissions, face detection starts a visible countdown. The full camera frame and location can be submitted through a Supabase Edge Function. This is a demonstration of browser APIs, not a proof of identity or a CAPTCHA.","tags":["Browser APIs","MediaPipe","Consent"],"url":"/lab","github":"","imageUrl":"","visual":"lab","color":"lavender","year":"College experiment","featured":false}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('post:building-with-curiosity','post','Building with curiosity, one project at a time','building-with-curiosity',false,20,'{"seoTitle":"","metaDescription":"","imageAlt":"","imageWidth":0,"imageHeight":0,"socialTitle":"","socialDescription":"","socialImageUrl":"","socialImageAlt":"","socialImageWidth":0,"socialImageHeight":0,"readerQuestion":"","experienceNotes":"","sources":[],"relatedProjectSlugs":[],"tags":["Learning","Projects"],"noindex":false,"category":"PERSONAL NOTES","excerpt":"Why small projects are my favorite way to connect the dots between an idea and something useful.","body":"The quickest way I know to discover what I don’t understand is to start building. A small project gives every new concept a place to live.\n\n## Start with one useful thing\nA project doesn’t need to do everything. A clear problem, a simple first version, and a little room for improvement are enough to get moving.\n\n## Follow the questions\nWhen a layout breaks or a request fails, the interesting lesson is often below the symptom. Reading the error, checking an assumption, and trying again are part of the work.\n\n## Leave it a little better\nSmall improvements add up: clearer copy, a better focus state, a smaller download. Making something useful is a process of paying attention.","date":"2026-10-30","readTime":"3 min read","imageUrl":"","visual":"curiosity","sample":true}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('post:building-for-people','post','The small details that make a website feel better','building-for-people',false,21,'{"seoTitle":"","metaDescription":"","imageAlt":"","imageWidth":0,"imageHeight":0,"socialTitle":"","socialDescription":"","socialImageUrl":"","socialImageAlt":"","socialImageWidth":0,"socialImageHeight":0,"readerQuestion":"","experienceNotes":"","sources":[],"relatedProjectSlugs":[],"tags":["Interfaces","Accessibility"],"noindex":false,"category":"WEB DEVELOPMENT","excerpt":"Clear feedback, readable type, and a button that does exactly what it promises.","body":"A good interface helps people know where they are, what just happened, and what they can do next.\n\n## Make feedback visible\nIf someone uploads a file, show its name. If a form fails, explain what they can fix. If a task is still running, show that work is in progress.\n\n## Give the content room\nReadable text and a calm layout make a site easier to use. Animation should support the content, and a reduced-motion preference should be respected.\n\n## Be clear about the next step\nA specific button label is a small kindness. It helps people understand what will happen before they act.","date":"2026-10-30","readTime":"4 min read","imageUrl":"","visual":"interfaces","sample":true}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('post:camera-demo','post','A browser experiment: camera, location, and consent','camera-location-consent',false,22,'{"seoTitle":"","metaDescription":"","imageAlt":"","imageWidth":0,"imageHeight":0,"socialTitle":"","socialDescription":"","socialImageUrl":"","socialImageAlt":"","socialImageWidth":0,"socialImageHeight":0,"readerQuestion":"","experienceNotes":"","sources":[],"relatedProjectSlugs":[],"tags":["Browser APIs","Project"],"noindex":false,"category":"PROJECT NOTES","excerpt":"What this portfolio’s interactive demo does, and why the explanation comes before the capture.","body":"This portfolio includes a camera-and-location experiment. It’s a way to explore browser APIs and a complete frontend-to-backend flow.\n\n## Explain the action first\nBefore starting, the demo explains that it captures a photo and location and emails them to the project owner. Browser permission prompts are an additional step, not a replacement for that explanation.\n\n## Keep the camera visible\nThe preview shows what the camera sees. Face detection runs locally and starts a visible countdown before capture. Camera tracks stop after the frame is captured or the participant cancels.\n\n## Handle the result honestly\nA failed submission should remain a failed submission. The real flow advances only after the backend accepts the message through the email service. Email-service acceptance is not proof of arrival in an inbox.","date":"2026-10-30","readTime":"4 min read","imageUrl":"","visual":"security","sample":true}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('page:privacy','page','Privacy & data','privacy',true,30,'{"intro":"A plain-language explanation of the information used by this project.","body":"## Contact form\nIf you send a message, your name, email, message, and optional attachment are stored privately in Supabase so the portfolio owner can reply. An email notification may also be sent to the owner. Do not attach sensitive documents.\n\n## Camera and location Lab\nThe optional Lab starts only after an explicit action and disclosure. A simulated walkthrough uses no device data. In device-only mode, camera and location permissions are requested, one full-frame photo is captured after local face detection and a countdown, and the photo and coordinates are shown only in the open dialog. They are not uploaded or emailed; closing the test discards the preview.\n\n## Connected submissions\nOnce the backend is configured, Continue and capture requests camera and location access under the email disclosure. One full-frame photo and coordinates with an accuracy estimate are uploaded privately and emailed to the portfolio owner. Camera access stops after capture, cancellation, failure, or timeout. Face detection happens locally and is not identity or liveness verification. You can cancel before capture. Email-service acceptance does not guarantee inbox delivery.\n\n## Storage and deletion\nDemo records include the submitted image path, coordinates, consent version, and submission time. The owner can delete records and stored files in the admin studio. Emailed copies must be deleted separately from the owner’s mailbox. Ask the owner to delete your submission using its reference ID.\n\n## Local storage\nNon-sensitive local preview content may be stored in this browser. A session-only marker remembers a successful demo submission for this tab. Administrator sign-in uses session storage. No analytics or advertising trackers are included.\n\n## Third-party services\nThe configured site uses Supabase for data and authentication, an email provider for delivery, and optionally Cloudflare Turnstile for spam prevention. Fonts are self-hosted; loading a page does not contact Google Fonts.\n\n## Questions\nContact the email shown on the Contact page to ask about your information. This college-project notice should be reviewed and updated before any public launch."}'::jsonb) on conflict (id) do nothing;
insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values ('page:terms','page','Project terms','terms',true,31,'{"intro":"An educational portfolio and a place to share my work.","body":"## About this project\nThis website is a personal portfolio and educational project. Project examples and learning notes describe work in progress. Sample articles are marked and can be replaced in the admin studio.\n\n## The interactive demo\nParticipation involves the camera and location information described before capture. This experiment is not a security control, age check, or proof of identity. A static-site gate is a presentation flow and cannot protect public frontend assets.\n\n## Respectful use\nPlease do not submit unlawful content, private information belonging to someone else, or malicious files. Contact attachments are restricted to supported images and PDF files.\n\n## Availability\nFeatures depend on browser support and configured services. If you need help or want a submission removed, contact the portfolio owner and include the submission reference if available."}'::jsonb) on conflict (id) do nothing;

commit;
