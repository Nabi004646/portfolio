import {readFile,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';

export async function validateBuild(outDir='dist',functionDir='functions/_generated') {
  const report=JSON.parse(await readFile(path.join(outDir,'seo-build-report.json'),'utf8'));
  const routeManifest=JSON.parse(await readFile(path.join(functionDir,'routes.json'),'utf8'));
  const routes=routeManifest.routes;const errors=[];const titles=new Map();const canonicals=new Map();const articleDescriptions=new Set();let tested=0;
  const meta=(html,key,property=false)=>{const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return html.match(new RegExp(`<meta ${property?'property':'name'}="${escaped}" content="([^"]*)"`))?.[1];};
  for(const [route,state] of Object.entries(routes)){
    if(state.status!==200)continue;
    const filename=route.endsWith('.html')?path.join(outDir,route):path.join(outDir,route,'index.html');const html=await readFile(filename,'utf8');tested++;
    const title=html.match(/<title>([^<]*)<\/title>/)?.[1];const canonical=html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    if(!title)errors.push(`${route}: title missing`);else if(titles.has(title))errors.push(`${route}: duplicate title with ${titles.get(title)}`);else titles.set(title,route);
    if(canonical!==new URL(route,report.origin).href)errors.push(`${route}: canonical is not self-referencing`);
    if(canonicals.has(canonical))errors.push(`${route}: duplicate canonical`);canonicals.set(canonical,route);
    if(!meta(html,'description'))errors.push(`${route}: missing meta description`);
    if((html.match(/<h1(?:\s[^>]*)?>/g)||[]).length!==1)errors.push(`${route}: expected one H1`);
    for(const key of ['og:title','og:description','og:url','og:image','og:image:width','og:image:height','og:image:alt'])if(!meta(html,key,true))errors.push(`${route}: missing ${key}`);
    for(const key of ['twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt'])if(!meta(html,key))errors.push(`${route}: missing ${key}`);
    if(!/^https?:\/\//.test(meta(html,'og:image',true)||''))errors.push(`${route}: social image is not absolute`);
    for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))try{const json=JSON.parse(match[1]);if(json['@type']==='BlogPosting'){
      const description=meta(html,'description');if(articleDescriptions.has(description))errors.push(`${route}: duplicate article description`);articleDescriptions.add(description);
      if(!json.author?.name||!json.author?.url||!json.headline||!json.articleBody)errors.push(`${route}: incomplete article structured data`);
      if(json.headline!==html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>'))errors.push(`${route}: structured headline differs from visible H1`);
      if(!html.includes(`datetime="${json.datePublished}"`)&&json.datePublished)errors.push(`${route}: publication date is not visible`);
      if(!html.includes(`datetime="${json.dateModified}"`)&&json.dateModified)errors.push(`${route}: modification date is not visible`);
      for(const image of html.matchAll(/<img\b[^>]*>/g)){
        const attribute=name=>image[0].match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
        if(attribute('alt')===undefined||!Number(attribute('width'))||!Number(attribute('height')))errors.push(`${route}: article image needs alt and reserved dimensions`);
      }
      const imageUrl=new URL(meta(html,'og:image',true));
      if(imageUrl.origin===report.origin){const image=await sharp(await readFile(path.join(outDir,imageUrl.pathname))).metadata();if(Number(meta(html,'og:image:width',true))!==image.width||Number(meta(html,'og:image:height',true))!==image.height)errors.push(`${route}: social image dimensions differ from the actual image`);}
    }else if(json['@type']==='BreadcrumbList'){
      if(!json.itemListElement?.length||json.itemListElement.some((entry,index)=>entry.position!==index+1||!entry.name||!/^https?:\/\//.test(entry.item)))errors.push(`${route}: invalid breadcrumb structured data`);
    }}catch{errors.push(`${route}: invalid JSON-LD`);}
    for(const match of html.matchAll(/href="([^"]+)"/g)){
      let url;try{url=new URL(match[1].replaceAll('&amp;','&'),new URL(route,report.origin));}catch{errors.push(`${route}: invalid link ${match[1]}`);continue;}
      if(url.origin!==report.origin||!['http:','https:'].includes(url.protocol))continue;
      if(url.hash&&url.pathname===route){const id=decodeURIComponent(url.hash.slice(1));if(!html.includes(`id="${id}"`))errors.push(`${route}: missing anchor ${id}`);continue;}
      if(routes[url.pathname]?.status===200)continue;
      try{if((await stat(path.join(outDir,url.pathname))).isFile())continue;}catch{}
      errors.push(`${route}: broken/noncanonical internal link ${url.pathname}`);
    }
    if(route.startsWith('/blog/')&&!route.startsWith('/blog/search/')){
      if(html.includes('id="demo-title"')||html.includes('gate-active'))errors.push(`${route}: public article/archive is gated`);
    }
  }
  const sitemap=await readFile(path.join(outDir,'sitemap.xml'),'utf8');
  for(const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)){const url=new URL(match[1].replaceAll('&amp;','&'));if(url.origin!==report.origin||routes[url.pathname]?.status!==200)errors.push(`Invalid sitemap URL ${url.href}`);if(/\/admin\/|\/search\/|\/tag\//.test(url.pathname))errors.push(`Excluded page found in sitemap ${url.pathname}`);}
  const rss=await readFile(path.join(outDir,'rss.xml'),'utf8');if(!rss.startsWith('<?xml')||!rss.includes('<rss version="2.0"'))errors.push('RSS is not valid RSS 2.0 structure');
  const vite=JSON.parse(await readFile(path.join(outDir,'.vite/manifest.json'),'utf8'));const assets=new Set();function collect(key){const item=vite[key];if(!item||assets.has(item.file))return;assets.add(item.file);for(const css of item.css||[])assets.add(css);for(const child of item.imports||[])collect(child);}collect('src/public-client.js');
  assets.add('theme-boot.js');
  if(routes['/']?.status===200&&(await readFile(path.join(outDir,'index.html'),'utf8')).includes('src="/intro-boot.js"'))assets.add('intro-boot.js');
  let raw=0,gzip=0;const assetBytes=[];for(const file of assets){const bytes=await readFile(path.join(outDir,file));raw+=bytes.length;gzip+=gzipSync(bytes).length;assetBytes.push({file,bytes:bytes.length,gzipBytes:gzipSync(bytes).length});}
  const result={checkedAt:new Date().toISOString(),passed:!errors.length,pagesChecked:tested,publishedArticles:report.articleCount,errors,initialPublicJsAndCss:{rawBytes:raw,gzipBytes:gzip,assets:assetBytes},limits:['Gzip byte counts are measured file sizes, not a browser performance score.','Live Cloudflare deployment, webhook delivery, Google indexing, social scrapers, and field Core Web Vitals are not validated by this local check.']};
  await writeFile(path.join(outDir,'seo-validation.json'),JSON.stringify(result,null,2));
  if(errors.length)throw new Error(`SEO validation failed:\n${errors.join('\n')}`);
  console.log(`SEO checks passed for ${tested} raw HTML pages. Initial public JS/CSS: ${gzip} gzip bytes (${raw} raw bytes).`);
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await validateBuild();
