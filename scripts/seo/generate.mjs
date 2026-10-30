import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadEnv} from 'vite';
import {defaultContent,getData,byKind} from '../../src/content.js';
import {createPublicViews} from '../../src/public-views.js';
import {seoSettings,publicPosts,postPath,taxonomy,absolute,articleMeta,articleStructuredData,breadcrumbData,jsonScript,authorData,dates,cleanPath} from '../../src/seo/model.js';
import {archiveView,articleView,authorView} from '../../src/seo/blog-views.js';
import {certificateSection} from '../../src/certificates.js';
import {esc,safeUrl} from '../../src/utils.js';
import {prepareSeoImages} from './assets.mjs';
import {introHead} from '../../src/intro.js';
import {isEntranceRoute} from '../../src/entrance-policy.js';
import {buildEnvironment} from '../build-environment.mjs';

const xml=value=>esc(value);
export async function fetchPublished({projectUrl,key}) {
  if(!projectUrl||!key)throw new Error('The Supabase URL and publishable key are both required.');
  if(!/^sb_publishable_/.test(key))throw new Error('Static generation must use a publishable key, never a secret/service-role key.');
  async function table(name,query) {
    const rows=[];for(let offset=0;;offset+=500){const response=await fetch(`${projectUrl}/rest/v1/${name}?${query}&limit=500&offset=${offset}`,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`Public content fetch failed for ${name}: ${response.status}. No stale build was published.`);const data=await response.json();rows.push(...data);if(data.length<500)return rows;}
  }
  return {items:await table('content_items','select=*&is_published=eq.true&order=sort_order.asc'),redirects:await table('site_routes','select=source_path,target_path,status&order=source_path.asc')};
}
export function headTags(meta,{site,indexable,css=[],entry,structured=[]}) {
  const robots=indexable&&!meta.noindex?'index,follow,max-image-preview:large':'noindex,follow';
  const socialImage=meta.image;const socialTitle=meta.socialTitle||meta.title;const socialDescription=meta.socialDescription||meta.description;
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/theme-boot.js"></script><meta name="theme-color" content="#f5f3ee"><title>${esc(meta.title)}</title><meta name="description" content="${esc(meta.description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${esc(meta.canonical)}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/rss+xml" title="${esc(site.blogTitle)}" href="/rss.xml">${css.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}<meta property="og:site_name" content="${esc(site.siteName)}"><meta property="og:type" content="${meta.type||'website'}"><meta property="og:title" content="${esc(socialTitle)}"><meta property="og:description" content="${esc(socialDescription)}"><meta property="og:url" content="${esc(meta.canonical)}"><meta property="og:locale" content="en_US"><meta property="og:image" content="${esc(socialImage)}"><meta property="og:image:secure_url" content="${esc(socialImage)}"><meta property="og:image:type" content="${socialImage?.endsWith('.png')?'image/png':'image/webp'}"><meta property="og:image:width" content="${meta.imageWidth||1200}"><meta property="og:image:height" content="${meta.imageHeight||630}"><meta property="og:image:alt" content="${esc(meta.imageAlt||site.defaultSocialAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(socialTitle)}"><meta name="twitter:description" content="${esc(socialDescription)}"><meta name="twitter:image" content="${esc(socialImage)}"><meta name="twitter:image:alt" content="${esc(meta.imageAlt||site.defaultSocialAlt)}">${site.twitterHandle&&/^@[A-Za-z0-9_]{1,15}$/.test(site.twitterHandle)?`<meta name="twitter:site" content="${esc(site.twitterHandle)}">`:''}${meta.published?`<meta property="article:published_time" content="${meta.published}">`:''}${meta.modified?`<meta property="article:modified_time" content="${meta.modified}">`:''}${structured.map(value=>`<script type="application/ld+json">${jsonScript(value)}</script>`).join('')}${introHead(meta)}${entry?`<script type="module" src="/${entry}"></script>`:''}`;
}
export async function generateSite({items,redirects=[],origin='http://localhost:4173',indexable=false,outDir='dist',manifestPath,projectUrl='',imageSourceHosts=[],publicDir='public',functionDir='functions/_generated'}={}) {
  const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('PUBLIC_SITE_URL must be a clean HTTP(S) origin.');origin=url.origin;
  if(indexable&&(url.protocol!=='https:'||/localhost|\.invalid$|\.example$/.test(url.hostname)))throw new Error('An indexable build needs your real HTTPS portfolio domain.');
  items=structuredClone(items).filter(item=>item.is_published&&!(['post','certificate','project'].includes(item.kind)&&item.data.sample));
  items=await prepareSeoImages(items,{origin,projectUrl,sourceHosts:imageSourceHosts,outDir,publicDir});
  const settings=getData(items,'settings');const site={...seoSettings.data,...getData(items,'seo-settings')};
  const validSlug=value=>typeof value==='string'&&value.length<=100&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
  if(!validSlug(site.authorSlug))throw new Error('The author profile needs a readable URL slug.');
  for(const record of items.filter(item=>['post','project','page'].includes(item.kind)))if(!validSlug(record.slug))throw new Error(`Invalid URL slug for ${record.id}.`);
  const views=createPublicViews({items,configured:Boolean(projectUrl)});const manifest=JSON.parse(await readFile(manifestPath||path.join(outDir,'.vite/manifest.json'),'utf8'));
  const publicEntry=manifest['src/public-client.js'];const appEntry=manifest['index.html'];if(!publicEntry||!appEntry)throw new Error('The Vite public and app entries are required.');
  const css=new Set();const visited=new Set();function collect(key){if(visited.has(key))return;visited.add(key);const value=manifest[key];for(const name of value?.css||[])css.add(name);for(const child of value?.imports||[])collect(child);}collect('src/public-client.js');
  const routes={};const sitemap=[];const pages=[];
  const defaults={description:settings.metaDescription||site.blogDescription,image:absolute(origin,'/assets/social-default.png'),imageWidth:1200,imageHeight:630,imageAlt:site.defaultSocialAlt};
  async function page(route,body,metadata={},structured=[],{app=false,sitemapEntry=true,status=200}={}) {
    const entranceRequired=settings.entranceRequired===true&&status===200&&isEntranceRoute(route);
    const meta={...defaults,introEnabled:settings.introEnabled!==false,entranceRequired,title:`${site.siteName} — ${settings.role||'Portfolio'}`,canonical:absolute(origin,route),...metadata};
    const payload={settings:{name:settings.name,brand:settings.brand,cream:settings.cream,blue:settings.blue,coral:settings.coral,entranceRequired:settings.entranceRequired===true,email:settings.email,demoRecipientLabel:settings.demoRecipientLabel,introEnabled:settings.introEnabled!==false,introTitle:settings.introTitle,introCaption:settings.introCaption},certificates:byKind(items,'certificate').filter(item=>item.data.imageUrl),certificateCopy:getData(items,'certificates-settings'),motionLabels:getData(items,'detail-copy').general||{}};
    const cssFiles=app?[...new Set([...(appEntry.css||[]),...css])]:[...css];
    const html=`<!doctype html><html lang="en" class="no-js" data-entrance="${entranceRequired?'required':'off'}" data-intro="${settings.introEnabled===false?'off':'on'}"><head>${headTags(meta,{site,indexable,css:cssFiles,entry:app?appEntry.file:publicEntry.file,structured})}</head><body><a class="skip-link" href="#main">Skip to content</a><div id="app">${app?body:views.header(route.replace(/\/$/,'')||'/')+`<main id="main" tabindex="-1">${body}</main>`+views.footer()}</div><div id="modal-root"></div><div id="toast-root" role="status" aria-live="polite"></div>${app?'':`<script id="public-page-data" type="application/json">${jsonScript(payload)}</script>`}</body></html>`;
    const normalized=html.replace(/href="(\/(?!\/)[^"?#]*)([?#][^"]*)?"/g,(all,pathname,fragment='')=>pathname==='/'||/\.[a-z0-9]+$/i.test(pathname)?all:`href="${cleanPath(pathname)}${fragment}"`);
    const filename=route.endsWith('.html')?path.join(outDir,route):path.join(outDir,route,'index.html');await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,normalized);
    routes[route]={status};pages.push({route,filename,meta,indexable:indexable&&!meta.noindex,status});
    if(status===200&&sitemapEntry&&!meta.noindex)sitemap.push({url:meta.canonical,lastmod:meta.modified||meta.published||null});
    return normalized;
  }
  for(const [id,route,render,title] of [['home','/',views.home,settings.name],['about','/about/',views.aboutPage,'About'],['contact','/contact/',views.contactPage,'Contact']])if(items.some(item=>item.id===id))await page(route,render(),{title:`${title} | ${site.titleSuffix}`});
  await page('/projects/',views.projectsPage(),{title:`Projects | ${site.titleSuffix}`});
  for(const project of byKind(items,'project'))await page(`/projects/${project.slug}/`,views.projectDetail(project.slug),{title:`${project.title} | ${site.titleSuffix}`,description:project.data.description||project.data.summary});
  await page('/certificates/',views.certificatesPage(),{title:`Certificates | ${site.titleSuffix}`,noindex:!byKind(items,'certificate').some(item=>!item.data.sample)});
  for(const record of byKind(items,'page'))await page(`/${record.slug}/`,views.textPage(record.slug),{title:`${record.title} | ${site.titleSuffix}`,description:record.data.intro||defaults.description});
  await page(`/author/${site.authorSlug}/`,authorView(items,site),{title:`${settings.name} — Author | ${site.titleSuffix}`,description:site.authorDescription},[{'@context':'https://schema.org','@type':'ProfilePage',mainEntity:authorData(items,site,origin)}]);
  const posts=publicPosts(items);const size=Math.max(1,Math.min(24,Number(site.archivePageSize)||6));
  const collections=[{path:'/blog/',title:site.blogTitle,posts,group:null,noindex:posts.length===0},...taxonomy(items).map(group=>({path:`/blog/category/${group.slug}/`,title:`${group.label} articles`,posts:group.posts,group,groupType:'category',noindex:false})),...taxonomy(items,'tags').map(group=>({path:`/blog/tag/${group.slug}/`,title:`${group.label} notes`,posts:group.posts,group,groupType:'tag',noindex:true}))];
  for(const collection of collections)for(let number=1;number<=Math.max(1,Math.ceil(collection.posts.length/size));number++){
    const route=number===1?collection.path:`${collection.path}page/${number}/`;
    await page(route,archiveView(items,site,{page:number,group:collection.group,groupType:collection.groupType}),{title:`${collection.title}${number>1?` — Page ${number}`:''} | ${site.titleSuffix}`,description:collection.group?`${collection.group.label} articles, reproducible examples, and learning notes by ${settings.name}.`:site.blogDescription,noindex:collection.noindex});
  }
  for(const post of posts){
    if(!post.slug||!post.data.body?.trim()||!post.data.metaDescription?.trim())throw new Error(`Published article ${post.id} needs a slug, body, and meta description.`);
    if(!dates(post).published)throw new Error(`Published article ${post.id} needs its genuine publication date.`);
    if(!post.data.imageUrl)throw new Error(`Published article ${post.id} needs a featured image.`);
    if(post.data.imageUrl&&!post.data.imageAlt?.trim())throw new Error(`Published article ${post.id} needs featured-image alt text.`);
    const rendered=articleView(post,items,site);const meta=articleMeta(post,site,origin);
    await page(postPath(post),rendered.html,meta,[articleStructuredData(post,items,site,origin,rendered.parsed.plainText),breadcrumbData(origin,rendered.crumbs)]);
  }
  await page('/blog/search/',`<section class="section text-page"><h1>Search published articles</h1><form role="search" action="/blog/search/" method="get" class="blog-search-form"><label for="public-search">Search</label><div><input id="public-search" name="q" type="search" maxlength="100"><button class="button button-primary" type="submit">Search</button></div></form><p id="search-status" role="status"></p><div id="search-results" class="article-grid"></div><noscript><p>Use the <a href="/blog/">crawlable blog archive</a> to browse articles without JavaScript.</p></noscript></section>`,{title:`Article search | ${site.titleSuffix}`,noindex:true},[],{sitemapEntry:false});
  await writeFile(path.join(outDir,'search-index.json'),JSON.stringify(posts.map(post=>({title:post.title,url:postPath(post),excerpt:post.data.excerpt,category:post.data.category}))));
  await page('/admin/','<main id="main" class="admin-auth"><section class="auth-card"><h1>Private content Studio</h1><p>Administrator sign-in and authenticator verification are required. No private content is included in this HTML.</p><noscript>JavaScript is required to sign in.</noscript></section></main>',{title:'Private Studio',noindex:true},[],{app:true,sitemapEntry:false});
  await page('/lab/',`<main id="main">${views.labPage()}</main>`,{title:`Camera & location lab | ${site.titleSuffix}`,noindex:true},[],{app:true,sitemapEntry:false});
  const errorHtml=await page('/404.html',views.notFound(),{title:`Page not found | ${site.titleSuffix}`,noindex:true},[],{status:404,sitemapEntry:false});
  const goneHtml=await page('/410.html','<section class="section text-page"><h1>This article has been removed.</h1><p>This previously published URL is no longer available.</p><a href="/blog/">Browse the blog →</a></section>',{title:`Article removed | ${site.titleSuffix}`,noindex:true},[],{status:410,sitemapEntry:false});
  for(const route of redirects){if(!/^\/blog\/[a-z0-9-]+\/$/.test(route.source_path)||![301,410].includes(route.status))throw new Error('Invalid stored article route');if(route.status===301&&!/^\/blog\/[a-z0-9-]+\/$/.test(route.target_path||''))throw new Error('Invalid redirect target');routes[route.source_path]={status:route.status,...(route.status===301?{target:route.target_path}:{})};}
  const sitemapXml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(indexable?sitemap:[]).map(entry=>`<url><loc>${xml(entry.url)}</loc>${entry.lastmod?`<lastmod>${entry.lastmod}</lastmod>`:''}</url>`).join('')}</urlset>`;
  await writeFile(path.join(outDir,'sitemap.xml'),sitemapXml);
  await writeFile(path.join(outDir,'robots.txt'),indexable?`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
  await writeFile(path.join(outDir,'rss.xml'),`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(site.blogTitle)}</title><link>${xml(origin)}/blog/</link><description>${xml(site.blogDescription)}</description><language>en</language><atom:link href="${xml(origin)}/rss.xml" rel="self" type="application/rss+xml"/>${posts.filter(post=>!post.data.noindex).map(post=>`<item><title>${xml(post.title)}</title><link>${xml(absolute(origin,postPath(post)))}</link><guid isPermaLink="true">${xml(absolute(origin,postPath(post)))}</guid><description>${xml(post.data.excerpt||post.data.metaDescription)}</description>${dates(post).published?`<pubDate>${new Date(dates(post).published).toUTCString()}</pubDate>`:''}</item>`).join('')}</channel></rss>`);
  if(site.enableLlmsTxt)await writeFile(path.join(outDir,'llms.txt'),`# ${site.siteName}\n\n> ${site.blogDescription}\n\n## Portfolio\n- [About](${origin}/about/)\n- [Author](${origin}/author/${site.authorSlug}/)\n- [Blog](${origin}/blog/)\n\n## Articles\n${posts.map(post=>`- [${post.title.replace(/[\r\n\[\]]/g,' ')}](${absolute(origin,postPath(post))})`).join('\n')}\n`);
  await writeFile(path.join(outDir,'_redirects'),'/rss /rss.xml 301\n/sitemap /sitemap.xml 301\n');
  await writeFile(path.join(outDir,'_routes.json'),JSON.stringify({version:1,include:['/blog','/blog/*','/admin','/admin/*'],exclude:[]}));
  const manifestData={origin,indexable,routes,errorHtml,goneHtml};await mkdir(functionDir,{recursive:true});await writeFile(path.join(functionDir,'routes.json'),JSON.stringify(manifestData));
  await writeFile(path.join(outDir,'seo-build-report.json'),JSON.stringify({generatedAt:new Date().toISOString(),indexable,origin,pageCount:pages.length,articleCount:posts.length,articleUrls:posts.map(post=>absolute(origin,postPath(post))),sitemapEntries:indexable?sitemap.length:0,redirectCount:redirects.length},null,2));
  return {pages,routes,items,sitemap,origin,indexable};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const env=buildEnvironment({...loadEnv('production',process.cwd(),''),...process.env});
  const projectUrl=env.VITE_SUPABASE_URL&&!env.VITE_SUPABASE_URL.includes('YOUR_')?env.VITE_SUPABASE_URL.replace(/\/$/,''):'';
  const source=env.CONTENT_SNAPSHOT?JSON.parse(await readFile(env.CONTENT_SNAPSHOT,'utf8')):projectUrl?await fetchPublished({projectUrl,key:env.VITE_SUPABASE_PUBLISHABLE_KEY}):{items:defaultContent,redirects:[]};
  const result=await generateSite({...source,origin:env.PUBLIC_SITE_URL||'http://localhost:4173',indexable:env.SEO_INDEXABLE==='true',projectUrl,imageSourceHosts:(env.IMAGE_SOURCE_HOSTS||'').split(',').filter(Boolean)});
  console.log(`Generated ${result.pages.length} HTML pages; ${publicPosts(result.items).length} published articles. Indexing ${result.indexable?'enabled':'disabled (preview)'}.`);
}
