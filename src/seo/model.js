import { esc, safeUrl, slugify } from '../utils.js';

export const ARTICLE_DEFAULTS = {
  seoTitle:'', metaDescription:'', imageAlt:'', imageWidth:0, imageHeight:0,
  socialTitle:'', socialDescription:'', socialImageUrl:'', socialImageAlt:'', socialImageWidth:0, socialImageHeight:0,
  readerQuestion:'', experienceNotes:'', sources:[], relatedProjectSlugs:[], tags:[], noindex:false,
};
export const seoSettings = {id:'seo-settings',kind:'settings',title:'SEO & author profile',slug:'',is_published:true,sort_order:9,data:{
  siteName:'Nabin Kunwar', titleSuffix:'Nabin Kunwar', blogTitle:'Development & security notes',
  blogDescription:'Practical notes on web development, Linux, cybersecurity learning, and projects by Nabin Kunwar.',
  authorSlug:'nabin-kunwar', authorBio:'Nabin Kunwar is a web developer and cybersecurity student in Nepal, with interests in Android development, robotics, neuroscience, and biology.',
  authorDescription:'About Nabin Kunwar, a web developer and cybersecurity student based in Nepal.',
  defaultSocialAlt:'Nabin Kunwar — web development and cybersecurity learning notes',
  twitterHandle:'', archivePageSize:6, enableLlmsTxt:false,
}};
export function postPath(post) { return `/blog/${post.slug}/`; }
export function cleanPath(path) { return path==='/'?'/':`/${String(path).replace(/^\/+|\/+$/g,'')}/`; }
export function absolute(origin, path) { return new URL(path, `${origin}/`).href; }
export function isoDate(value) {
  if (typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const calendar=new Date(`${value.slice(0,10)}T00:00:00Z`);if(!Number.isFinite(calendar.valueOf())||calendar.toISOString().slice(0,10)!==value.slice(0,10))return null;
  const date=new Date(value);if(!Number.isFinite(date.valueOf()))return null;
  return date.toISOString();
}
export function dates(post) {
  const published=isoDate(post.first_published_at)||isoDate(post.data?.date);
  const modified=isoDate(post.content_modified_at);
  return {published,modified:modified&&published&&modified>=published?modified:null};
}
export function publicPosts(items) { return items.filter(item=>item.kind==='post'&&item.is_published&&!item.data?.sample).sort((a,b)=>String(dates(b).published||'').localeCompare(String(dates(a).published||''))||a.slug.localeCompare(b.slug)); }
export function taxonomy(items, key='category') {
  const groups=new Map();
  for(const post of publicPosts(items))for(const label of key==='tags'?(post.data.tags||[]):[post.data.category]){
    if(typeof label!=='string'||!label.trim())continue;const slug=slugify(label);if(!slug)continue;
    if(!groups.has(slug))groups.set(slug,{slug,label:label.trim(),posts:[]});groups.get(slug).posts.push(post);
  }
  return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label));
}
export function readingTime(body='') { return `${Math.max(1,Math.ceil(String(body).split(/\s+/).filter(Boolean).length/220))} min read`; }
export function articleMeta(post,site,origin) {
  const d=post.data;const title=d.seoTitle?.trim()||post.title;const image=d.socialImageUrl||d.imageUrl||'/assets/social-default.png';
  return {title,description:d.metaDescription?.trim()||d.excerpt||'',canonical:absolute(origin,postPath(post)),
    socialTitle:d.socialTitle?.trim()||title,socialDescription:d.socialDescription?.trim()||d.metaDescription||d.excerpt||'',
    image:absolute(origin,safeUrl(image)||'/assets/social-default.png'),imageAlt:d.socialImageAlt||d.imageAlt||site.defaultSocialAlt,
    imageWidth:Number(d.socialImageUrl?d.socialImageWidth:d.imageWidth)||1200,imageHeight:Number(d.socialImageUrl?d.socialImageHeight:d.imageHeight)||630,
    type:'article',noindex:Boolean(d.noindex),...dates(post)};
}
export function jsonScript(value) { return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029'); }
export function breadcrumbData(origin,crumbs) {return {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:crumbs.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.name,item:absolute(origin,item.path)}))};}
export function breadcrumbs(crumbs) {return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${crumbs.map((crumb,index)=>`<li>${index===crumbs.length-1?`<span aria-current="page">${esc(crumb.name)}</span>`:`<a href="${esc(crumb.path)}">${esc(crumb.name)}</a>`}</li>`).join('')}</ol></nav>`;}
export function authorData(items,site,origin) {
  const settings=items.find(item=>item.id==='settings')?.data||{};
  return {'@type':'Person','@id':absolute(origin,`/author/${site.authorSlug}/#person`),name:settings.name,url:absolute(origin,`/author/${site.authorSlug}/`),description:site.authorBio,sameAs:[settings.facebook,settings.github,settings.linkedin].filter(value=>safeUrl(value)),...(settings.portraitUrl?{image:absolute(origin,settings.portraitUrl)}:{})};
}
export function articleStructuredData(post,items,site,origin,plainText) {
  const meta=articleMeta(post,site,origin);const published=dates(post).published;
  const structured={'@context':'https://schema.org','@type':'BlogPosting','@id':`${meta.canonical}#article`,headline:post.title,description:meta.description,
    mainEntityOfPage:{'@type':'WebPage','@id':meta.canonical},author:authorData(items,site,origin),inLanguage:'en',articleBody:plainText,
    image:{'@type':'ImageObject',url:absolute(origin,safeUrl(post.data.imageUrl)||'/assets/social-default.png'),width:Number(post.data.imageWidth)||1200,height:Number(post.data.imageHeight)||630,caption:post.data.imageAlt||site.defaultSocialAlt},
    ...(published?{datePublished:published}:{}),...(meta.modified?{dateModified:meta.modified}:{}),...(post.data.category?{articleSection:post.data.category}:{}),...(post.data.tags?.length?{keywords:post.data.tags.join(', ')}:{})};
  return structured;
}
