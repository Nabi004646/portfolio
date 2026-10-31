import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database,seoMigration,asRole} from './helpers/database.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const stranger='22222222-2222-4222-8222-222222222222';
const hook='https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/test-only-connection';
const endpoint='https://xgtqpixoutlhqhflkpqs.supabase.co/functions/v1/request-publish';
test('publishing configuration requires an AAL2 owner and keeps hook retrieval server-only',async()=>{
  const db=await database();
  try{
    await seoMigration(db);
    // Test adapters for hosted Vault encryption and pg_net transport. No real hooks.
    await db.exec(`create schema vault;create schema net;create schema extensions;
      create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(repeat('ab',$1),'hex')$$;
      create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text);
      create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
      create function vault.create_secret(text,text,text) returns uuid language sql as $$insert into vault.secrets(secret,name) values($1,$2) returning id$$;
      create function vault.update_secret(uuid,text,text,text) returns void language sql as $$update vault.secrets set secret=$2,name=$3 where id=$1$$;
      create table net.requests(url text,headers jsonb,body jsonb);
      create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$insert into net.requests values($1,$2,$3);select 1::bigint$$;
      insert into auth.users values('${owner}'),('${stranger}');insert into public.admin_members(user_id) values('${owner}');`);
    const sql=(await readFile('supabase/setup/publishing-connection.sql','utf8')).replace('create extension if not exists pg_net with schema extensions;','');
    await db.exec(sql);
    for(const [role,id,aal] of [['anon','','aal1'],['authenticated',owner,'aal1'],['authenticated',stranger,'aal2']]){
      await asRole(db,role,id,aal);
      await assert.rejects(db.query('select public.configure_portfolio_publishing($1,$2)',[hook,endpoint]));
      await assert.rejects(db.query('select public.get_portfolio_publish_config()'));
    }
    await asRole(db,'authenticated',owner,'aal2');
    await assert.rejects(db.query('select public.get_portfolio_publish_config()'));
    for(const bad of ['https://evil.test/hook','http://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/test-only','https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/test-only?redirect=evil'])await assert.rejects(db.query('select public.configure_portfolio_publishing($1,$2)',[bad,endpoint]));
    assert.deepEqual((await db.query('select public.configure_portfolio_publishing($1,$2) as result',[hook,endpoint])).rows[0].result,{configured:true});
    await db.query("insert into public.content_items(id,kind,title,is_published,data) values('publish-test','project','Owner edit',true,'{}')");
    await db.exec('reset role');
    const request=(await db.query('select * from net.requests')).rows[0];assert.equal(request.url,endpoint);
    assert.equal(request.headers['x-publish-secret'].length,64);assert.ok(!JSON.stringify(request.body).includes(hook));
    await asRole(db,'service_role');
    const config=(await db.query('select public.get_portfolio_publish_config() as config')).rows[0].config;
    assert.equal(config.deploy_hook,hook);assert.equal(config.webhook_secret.length,64);
  }finally{await db.close();}
});
