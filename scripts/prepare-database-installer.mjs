import {readFile,writeFile} from 'node:fs/promises';

// A convenience for a fresh project's SQL editor; existing projects use migrations.
const migrations=[
  '20261030121214_portfolio.sql',
  '20261030121218_certificates.sql',
  '20261030121222_seo_publishing.sql',
  '20261030121225_contacts_and_intro.sql',
  '20261030121707_harden_portfolio_privileges.sql',
];
const statements=await Promise.all(migrations.map(name=>readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8')));
const seed=await readFile(new URL('../supabase/seed.sql',import.meta.url),'utf8');
const guard=`-- Fresh portfolio installation for project xgtqpixoutlhqhflkpqs.
-- Run ONCE in Supabase SQL Editor. Existing installations use migrations.
-- This guarded transaction creates portfolio objects and published starter copy.
-- It does not create an Auth user, set a password, or contain secret keys.
begin;
do $$ begin
  if to_regclass('public.content_items') is not null then
    raise exception 'Portfolio tables already exist. Use unapplied migrations instead of this fresh installer.';
  end if;
end $$;
`;
await writeFile(new URL('../supabase/setup/install-fresh-project.sql',import.meta.url),guard+statements.map((sql,index)=>`\n-- ${migrations[index]}\n${sql}`).join('\n')+'\n-- Initial content; does not overwrite rows.\n'+seed+'\ncommit;\n');
console.log('Prepared guarded fresh-project SQL installer (no credentials).');
