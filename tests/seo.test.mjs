import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {generateSite,fetchPublished} from '../scripts/seo/generate.mjs';
import {validateBuild} from '../scripts/seo/validate.mjs';
import {prepareSeoImages} from '../scripts/seo/assets.mjs';
import {renderArticleMarkdown} from '../src/seo/markdown.js';
import {routePolicy} from '../src/seo/route-policy.js';
import {publishingIssues} from '../src/seo/admin-preview.js';
import {seoFixture} from './helpers/seo-fixture.mjs';
import {isoDate} from '../src/seo/model.js';

test('Markdown stays safe, preserves readable code and provides a logical linked table of contents',()=>{
  const rendered=renderArticleMarkdown('# Heading\n\n#### Deep\n\n## Heading\n\n## Fourth\n\n<script>evil()</script>\n\n```js\nalert("<svg>")\n```');
  assert.ok(!rendered.html.includes('<h1')&&!rendered.html.includes('<script>'));
  assert.match(rendered.html,/id="heading-2"/);assert.match(rendered.html,/<h3 id="deep">/);
  assert.match(rendered.toc,/href="#deep"/);assert.match(rendered.html,/<pre tabindex="0"/);
  assert.match(rendered.html,/&lt;svg&gt;/);
  const repeated=renderArticleMarkdown('## Heading\n\n## Heading\n\n## Heading 2\n\n`my_file`');
  assert.equal(new Set(repeated.headings.map(heading=>heading.id)).size,3);assert.match(repeated.plainText,/my_file/);
  assert.equal(isoDate('2025-02-01T00:00:00+05:45'),'2025-01-31T18:15:00.000Z');assert.equal(isoDate('2025-02-30'),null);
});

test('the static build exports full article HTML, real image dimensions, crawlable pagination and no draft content',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'portfolio-seo-'));const outDir=path.join(root,'dist');const publicDir=path.join(root,'public');const functionDir=path.join(root,'functions');
  try {
    await cp('dist',outDir,{recursive:true});await mkdir(publicDir);
    await sharp({create:{width:1500,height:800,channels:3,background:'#3156eb'}}).png().toFile(path.join(publicDir,'test-featured.png'));
    const source=seoFixture();const result=await generateSite({...source,outDir,publicDir,functionDir,origin:'https://portfolio.test',indexable:true});
    const report=await validateBuild(outDir,functionDir);assert.equal(report.passed,true);assert.equal(report.publishedArticles,8);
    const html=await readFile(path.join(outDir,'blog/fixture-note-1/index.html'),'utf8');
    assert.match(html,/<title>Fixture SEO title 1<\/title>/);
    assert.match(html,/<link rel="canonical" href="https:\/\/portfolio.test\/blog\/fixture-note-1\/"/);
    assert.match(html,/This is a synthetic question and answer/);assert.match(html,/aria-label="On this page"/);
    assert.equal((html.match(/<h1(?:\s[^>]*)?>/g)||[]).length,1);
    assert.match(html,/width="1200" height="640"/);assert.match(html,/srcset="[^"]+480w[^"]+840w[^"]+1200w/);
    const structured=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
    assert.equal(structured[0]['@type'],'BlogPosting');assert.equal(structured[0].datePublished,'2025-02-01T10:00:00.000Z');
    assert.equal(structured[0].dateModified,'2025-02-03T12:00:00.000Z');assert.equal(structured[0].image.width,1200);
    assert.equal(structured[1]['@type'],'BreadcrumbList');assert.match(html,/rel="author" href="\/author\/nabin-kunwar\/"/);
    assert.match(await readFile(path.join(outDir,'blog/index.html'),'utf8'),/href="\/blog\/page\/2\/"/);
    assert.match(await readFile(path.join(outDir,'blog/page/2/index.html'),'utf8'),/rel="prev" href="\/blog\/"/);
    assert.match(await readFile(path.join(outDir,'blog/search/index.html'),'utf8'),/name="robots" content="noindex,follow"/);
    assert.match(await readFile(path.join(outDir,'blog/tag/linux/index.html'),'utf8'),/name="robots" content="noindex,follow"/);
    const sitemap=await readFile(path.join(outDir,'sitemap.xml'),'utf8');const rss=await readFile(path.join(outDir,'rss.xml'),'utf8');
    assert.match(sitemap,/<loc>https:\/\/portfolio.test\/blog\/fixture-note-1\/<\/loc>/);
    assert.ok(!sitemap.includes('/tag/')&&!sitemap.includes('/search/')&&!sitemap.includes('deleted-fixture'));
    assert.match(rss,/<guid isPermaLink="true">https:\/\/portfolio.test\/blog\/fixture-note-1\/<\/guid>/);
    assert.match(await readFile(path.join(outDir,'llms.txt'),'utf8'),/fixture-note-1/);
    async function inspect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await inspect(file);else if(/\.(html|xml|json|txt)$/.test(file)&&!file.includes('/.vite/'))assert.ok(!(await readFile(file,'utf8')).includes('DRAFT_SECRET'),file);}}
    await inspect(outDir);assert.ok(!JSON.stringify(result.routes).includes('private-draft'));
    // Removing a post in the next snapshot removes it from sitemap and RSS.
    await generateSite({...source,items:source.items.filter(item=>item.id!=='fixture-1'),outDir,publicDir,functionDir,origin:'https://portfolio.test',indexable:true});
    assert.ok(!(await readFile(path.join(outDir,'sitemap.xml'),'utf8')).includes('/fixture-note-1/'));
    assert.ok(!(await readFile(path.join(outDir,'rss.xml'),'utf8')).includes('/fixture-note-1/'));
  } finally {await rm(root,{recursive:true,force:true});}
});

test('route responses use permanent redirects, genuine 404/410 and noindex private/search/filter pages',async()=>{
  const manifest={routes:{'/blog/':{status:200},'/blog/page/2/':{status:200},'/blog/article/':{status:200},'/blog/old/':{status:301,target:'/blog/article/'},'/blog/gone/':{status:410},'/blog/search/':{status:200}},errorHtml:'Not found',goneHtml:'Removed'};
  const assets=async()=>new Response('Public HTML',{status:200});
  const get=path=>routePolicy(new Request(`https://portfolio.test${path}`),manifest,assets);
  for(const [path,status,location] of [['/blog',301,'/blog/'],['/blog/article',301,'/blog/article/'],['/blog/old/',301,'/blog/article/'],['/blog/?page=2',301,'/blog/page/2/'],['/blog/gone/',410],['/blog/missing/',404],['/blog/tag/empty/',404],['/blog/page/999/',404],['/admin/anything',404]]){
    const response=await get(path);assert.equal(response.status,status,path);if(location)assert.equal(response.headers.get('location'),location);
  }
  assert.match((await get('/admin/')).headers.get('x-robots-tag'),/noindex/);
  assert.match((await get('/blog/search/?q=hello')).headers.get('x-robots-tag'),/noindex/);
  assert.match((await get('/blog/?sort=newest')).headers.get('x-robots-tag'),/noindex/);
  assert.equal((await get('/blog/article/')).status,200);
});

test('publishing blocks incomplete/sample articles and builds reject privileged keys or unapproved image sources',async()=>{
  const source=seoFixture(1);assert.deepEqual(publishingIssues(source.items.find(item=>item.kind==='post')),[]);
  const incomplete={kind:'post',slug:'search',is_published:true,data:{sample:true}};assert.ok(publishingIssues(incomplete).length>=4);
  await assert.rejects(fetchPublished({projectUrl:'https://project.supabase.co',key:'sb_secret_NEVER_USE_IN_BUILD'}),/publishable key/);
  const root=await mkdtemp(path.join(tmpdir(),'portfolio-assets-'));
  try{
    const post=source.items.find(item=>item.kind==='post');post.data.imageUrl='https://unapproved.invalid/image.jpg';
    await assert.rejects(prepareSeoImages([post],{origin:'https://portfolio.test',outDir:root}),/not allowed/);
    post.data.imageUrl='local-media:private-browser-image';
    await assert.rejects(prepareSeoImages([post],{origin:'https://portfolio.test',outDir:root}),/Browser-only/);
  }finally{await rm(root,{recursive:true,force:true});}
});
