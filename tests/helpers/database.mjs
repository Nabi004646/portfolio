import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

export async function database() {
  const db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
  `);
  for(const name of ['20261030121214_portfolio.sql','20261030121218_certificates.sql'])await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8'));
  return db;
}
export async function seoMigration(db){await db.exec(await readFile(new URL('../../supabase/migrations/20261030121222_seo_publishing.sql',import.meta.url),'utf8'));}

export async function asRole(db,role,id='',aal='aal1') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal})]);
  if(!['anon','authenticated','service_role'].includes(role))throw new Error('Invalid test role');
  await db.exec(`set role ${role}`);
}
