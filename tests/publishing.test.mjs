import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database,seoMigration,asRole} from './helpers/database.mjs';

const data={body:'## A verified local example\n\nThe article body.',metaDescription:'A unique fixture description.',imageUrl:'/fixture.png',imageAlt:'A fixture terminal screenshot'};
const admin='11111111-1111-4111-8111-111111111111';
test('publication lifecycle preserves genuine dates, URL history, draft privacy, and a retryable private queue',async()=>{
  const db=await database();
  try {
    // Simulate an article that existed before this migration, with a genuine date.
    await db.query("insert into public.content_items(id,kind,title,slug,is_published,data) values('legacy','post','Legacy article','legacy',true,$1)",[{...data,metaDescription:'Legacy description',date:'2024-01-15'}]);
    await seoMigration(db);
    await db.query("insert into public.content_items(id,kind,title,is_published,data) values('settings','settings','Site',false,$1)",[{brand:'Owner copy',introEnabled:false,socialLinks:[{label:'GitHub',url:'https://github.com/Nabi004646'},{label:'Other',url:'https://example.com/'}]}]);
    await db.exec(await readFile(new URL('../supabase/migrations/20261030121225_contacts_and_intro.sql',import.meta.url),'utf8'));
    const migrated=(await db.query("select data from public.content_items where id='settings'")).rows[0].data;
    assert.equal(migrated.brand,'Owner copy');assert.equal(migrated.introEnabled,false);
    assert.equal(migrated.socialLinks.filter(link=>link.label==='GitHub').length,1);
    assert.ok(migrated.socialLinks.some(link=>link.label==='Other'));
    assert.equal(migrated.facebook,'https://www.facebook.com/nabie.webdev');assert.equal(migrated.personalLinks.length,2);
    assert.equal(new Date((await db.query("select first_published_at from public.content_items where id='legacy'")).rows[0].first_published_at).toISOString(),'2024-01-15T00:00:00.000Z');
    assert.equal((await db.query("select content_modified_at from public.content_items where id='legacy'")).rows[0].content_modified_at,null);
    await db.exec(`insert into auth.users values('${admin}');insert into public.admin_members(user_id) values('${admin}');`);
    await asRole(db,'authenticated',admin,'aal2');
    await db.query("insert into public.content_items(id,kind,title,slug,is_published,data) values('article','post','Article one','original-slug',false,$1)",[data]);
    assert.equal((await db.query('select pending_count from public.publishing_status')).rows[0].pending_count,0);
    await asRole(db,'anon');
    assert.equal((await db.query("select id from public.content_items where id='article'")).rows.length,0);
    await assert.rejects(db.query('select * from private.publish_queue'));
    await assert.rejects(db.query('select public.claim_publish_batch()'));
    await assert.rejects(db.query('select * from public.publishing_status'));
    await asRole(db,'authenticated',admin,'aal1');
    assert.equal((await db.query("update public.content_items set is_published=true where id='article' returning id")).rows.length,0);
    assert.equal((await db.query('select * from public.publishing_status')).rows.length,0);
    await asRole(db,'authenticated',admin,'aal2');
    await assert.rejects(db.query("insert into public.content_items(id,kind,title,slug,is_published,data) values('empty','post','Empty','empty',true,'{}')"),/content is required/);
    await assert.rejects(db.query("insert into public.content_items(id,kind,title,slug,is_published,data) values('sample','post','Sample','sample',true,$1)",[{...data,sample:true}]),/sample article/);
    await db.exec("update public.content_items set is_published=true where id='article'");
    const first=(await db.query("select * from public.content_items where id='article'")).rows[0];
    assert.ok(first.first_published_at);assert.deepEqual(first.first_published_at,first.content_modified_at);
    await db.exec("update public.content_items set data=jsonb_set(data,'{seoTitle}','\"A better search title\"') where id='article'");
    const metaEdit=(await db.query("select * from public.content_items where id='article'")).rows[0];
    assert.deepEqual(metaEdit.content_modified_at,first.content_modified_at);
    await db.exec("update public.content_items set title='A new visible title',first_published_at='2000-01-01' where id='article'");
    const titleEdit=(await db.query("select * from public.content_items where id='article'")).rows[0];
    assert.equal(titleEdit.slug,'original-slug');assert.deepEqual(titleEdit.first_published_at,first.first_published_at);
    assert.ok(new Date(titleEdit.content_modified_at)>=new Date(first.content_modified_at));
    await assert.rejects(db.query("insert into public.content_items(id,kind,title,slug,is_published,data) values('duplicate','post','Different','different',true,$1)",[data]),/unique_published_meta_description/);
    await db.exec("update public.content_items set slug='second-slug' where id='article';update public.content_items set slug='final-slug' where id='article'");
    await asRole(db,'anon');
    assert.deepEqual((await db.query('select source_path,target_path,status from public.site_routes order by source_path')).rows,[
      {source_path:'/blog/original-slug/',target_path:'/blog/final-slug/',status:301},
      {source_path:'/blog/second-slug/',target_path:'/blog/final-slug/',status:301},
    ]);
    await assert.rejects(db.query('select record_id from public.site_routes'));
    await asRole(db,'authenticated',admin,'aal2');
    await assert.rejects(db.query("insert into public.content_items(id,kind,title,slug,is_published,data) values('reuse','post','Reuse','original-slug',false,'{}')"),/historical article URL/);
    await db.exec("update public.content_items set is_published=false where id='article'");
    await asRole(db,'anon');assert.equal((await db.query("select id from public.content_items where id='article'")).rows.length,0);
    await asRole(db,'authenticated',admin,'aal2');await db.exec("delete from public.content_items where id='article'");
    await asRole(db,'anon');
    const gone=(await db.query('select source_path,target_path,status from public.site_routes')).rows;
    assert.equal(gone.length,3);assert.ok(gone.every(row=>row.status===410&&row.target_path===null));
    await asRole(db,'service_role');
    const batch=(await db.query('select public.claim_publish_batch() as batch')).rows[0].batch;
    assert.ok(batch.count>=5);
    assert.equal((await db.query('select public.claim_publish_batch() as batch')).rows[0].batch.count,0);
    await db.query('select public.finish_publish_batch($1,false)',[batch.batch_id]);
    assert.equal((await db.query('select state from public.publishing_status')).rows[0].state,'failed');
    const retry=(await db.query('select public.claim_publish_batch() as batch')).rows[0].batch;
    assert.equal(retry.count,batch.count);
    await db.query('select public.finish_publish_batch($1,true)',[retry.batch_id]);
    assert.deepEqual((await db.query('select state,pending_count,last_error from public.publishing_status')).rows[0],{state:'requested',pending_count:0,last_error:null});
  } finally {await db.close();}
});
