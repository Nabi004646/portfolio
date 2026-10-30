import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('database policies enforce allowlisted AAL2 administrators across content, private records, and files', async () => {
  const db = new PGlite();
  try {
    // Stand-ins for Supabase-owned roles and schemas; real PostgreSQL executes
    // the shipped migration and policies, including security-definer functions.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
      grant usage on schema auth, storage to anon, authenticated, service_role;
      grant execute on all functions in schema auth to anon, authenticated, service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
      create function public.rls_auto_enable() returns void language plpgsql security definer as $$ begin null; end $$;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20261030121214_portfolio.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261030121218_certificates.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261030121222_seo_publishing.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261030121225_contacts_and_intro.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261030121707_harden_portfolio_privileges.sql',import.meta.url),'utf8'));
    assert.equal((await db.query("select has_function_privilege('anon','public.rls_auto_enable()','execute') as allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.rls_auto_enable()','execute') as allowed")).rows[0].allowed,false);
    const admin='11111111-1111-4111-8111-111111111111', outsider='22222222-2222-4222-8222-222222222222';
    await db.exec(`insert into auth.users values('${admin}'),('${outsider}'); insert into public.admin_members values('${admin}',now());
      insert into public.content_items(id,kind,title,is_published,data) values('public','page','Public',true,'{}'),('draft','page','Draft',false,'{}');
      insert into public.submissions(id,kind,payload_hash,name,email,message,consent_version,consent_at,consent_text)
      values('33333333-3333-4333-8333-333333333333','contact',repeat('a',64),'Visitor','visitor@example.com','Private note','contact-v1',now(),'Consent');
      insert into storage.objects(bucket_id,name) values('portfolio-private','private.jpg');`);
    async function as(role, id='', aal='aal1') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal})]); await db.exec(`set role ${role}`); }
    await as('anon');
    assert.deepEqual((await db.query('select id from public.content_items order by id')).rows.map(r=>r.id),['public']);
    await assert.rejects(db.query("insert into public.content_items(id,kind,title) values('bad','page','Bad')"));
    await assert.rejects(db.query("insert into public.content_items(id,kind,title) values('bad-cert','certificate','Bad certificate')"));
    await assert.rejects(db.query('select * from public.submissions'));
    await assert.rejects(db.query("select public.portfolio_take_rate_limit(repeat('a',64),8)"));
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('portfolio-private','bad.jpg')"));
    assert.equal((await db.query("select * from storage.objects where bucket_id='portfolio-private'")).rows.length,0);
    await as('authenticated',admin,'aal1');
    assert.equal((await db.query('select * from public.admin_members')).rows.length,1);
    assert.equal((await db.query('select public.is_portfolio_admin() as ok')).rows[0].ok,false);
    assert.equal((await db.query('select * from public.content_items')).rows.length,1);
    assert.equal((await db.query('select * from public.submissions')).rows.length,0);
    await assert.rejects(db.query("insert into public.content_items(id,kind,title) values('bad','page','Bad')"));
    await as('authenticated',outsider,'aal2');
    assert.equal((await db.query('select public.is_portfolio_admin() as ok')).rows[0].ok,false);
    assert.equal((await db.query('select * from public.admin_members')).rows.length,0);
    await assert.rejects(db.query(`insert into public.admin_members(user_id) values('${outsider}')`));
    await assert.rejects(db.query("insert into public.content_items(id,kind,title) values('bad','page','Bad')"));
    await as('authenticated',admin,'aal2');
    assert.equal((await db.query('select public.is_portfolio_admin() as ok')).rows[0].ok,true);
    assert.equal((await db.query('select * from public.content_items')).rows.length,2);
    assert.equal((await db.query('select * from public.submissions')).rows.length,1);
    assert.equal((await db.query("select * from storage.objects where bucket_id='portfolio-private'")).rows.length,1);
    await db.exec("insert into public.content_items(id,kind,title) values('new','page','New'); update public.content_items set title='Edited' where id='new'; delete from public.content_items where id='new';");
    assert.equal((await db.query("select * from public.audit_events where record_id='new'")).rows.length,3);
    await db.exec("insert into public.content_items(id,kind,title,is_published,data) values('cert-test','certificate','Test certificate',false,'{\"imageUrl\":\"https://example.com/test.png\"}');");
    await as('anon');
    assert.equal((await db.query("select * from public.content_items where kind='certificate'")).rows.length,0);
    await as('authenticated',admin,'aal1');
    assert.equal((await db.query("update public.content_items set is_published=true where id='cert-test' returning id")).rows.length,0);
    await as('authenticated',admin,'aal2');
    await db.exec("update public.content_items set title='Updated certificate',is_published=true where id='cert-test';");
    await as('anon');
    assert.equal((await db.query("select title from public.content_items where kind='certificate'")).rows[0].title,'Updated certificate');
    await as('authenticated',admin,'aal2');
    await db.exec("delete from public.content_items where id='cert-test';");
    assert.equal((await db.query("select * from public.content_items where id='cert-test'")).rows.length,0);
    await assert.rejects(db.query("delete from public.audit_events"));
    await db.exec("insert into storage.objects(bucket_id,name) values('portfolio-media','portrait.jpg'); delete from storage.objects where bucket_id='portfolio-private';");
    await as('service_role');
    const allowed=[]; for(let i=0;i<4;i++)allowed.push((await db.query("select public.portfolio_take_rate_limit(repeat('b',64),3) as ok")).rows[0].ok);
    assert.deepEqual(allowed,[true,true,true,false]);
  } finally { await db.close(); }
});
