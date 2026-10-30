import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export async function prepareSeoImages(items,{origin,projectUrl='',sourceHosts=[],outDir='dist',publicDir='public',strict=false}) {
  const output=structuredClone(items);const dir=path.join(outDir,'assets','images');await mkdir(dir,{recursive:true});const cache=new Map();
  const allowed=new Set([new URL(origin).hostname,...sourceHosts]);if(projectUrl)allowed.add(new URL(projectUrl).hostname);
  async function optimize(source) {
    if(cache.has(source))return cache.get(source);
    const pending=(async()=>{
      if(typeof source!=='string'||source.startsWith('local-media:'))throw new Error('Browser-only image references cannot be published. Upload this image to Supabase first.');
      let bytes;
      if(source.startsWith('/')&&!source.startsWith('//')) {
        const filename=path.resolve(publicDir,'.'+source);if(!filename.startsWith(path.resolve(publicDir)+path.sep))throw new Error('Unsafe image path');bytes=await readFile(filename);
      } else {
        const url=new URL(source);if(url.protocol!=='https:'||!allowed.has(url.hostname))throw new Error(`Image host ${url.hostname} is not allowed. Use public Supabase media or configure IMAGE_SOURCE_HOSTS.`);
        const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Image fetch failed (${response.status}).`);
        const maximum=10*1024*1024;const reader=response.body.getReader();const chunks=[];let total=0;
        while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>maximum){await reader.cancel();throw new Error('Image exceeds 10 MB.');}chunks.push(value);}bytes=Buffer.concat(chunks.map(chunk=>Buffer.from(chunk)));
      }
      const image=sharp(bytes,{limitInputPixels:64000000}).rotate();const original=await image.metadata();if(!['jpeg','png','webp','avif'].includes(original.format))throw new Error('Featured images must be JPEG, PNG, WebP, or AVIF.');
      const id=createHash('sha256').update(bytes).digest('hex').slice(0,16);const variants=[];let largest;
      for(const width of [480,840,1200]){
        const filename=`${id}-${width}.webp`;const result=await image.clone().resize({width,withoutEnlargement:true}).webp({quality:80}).toFile(path.join(dir,filename));
        const entry={url:`/assets/images/${filename}`,width:result.width,height:result.height};if(!variants.some(item=>item.width===entry.width))variants.push(entry);largest=entry;
      }
      return {...largest,srcset:variants.map(item=>`${item.url} ${item.width}w`).join(', ')};
    })();cache.set(source,pending);return pending;
  }
  for(const post of output.filter(item=>item.kind==='post'&&item.is_published&&!item.data.sample)){
    if(post.data.imageUrl){const image=await optimize(post.data.imageUrl);post.data.imageUrl=image.url;post.data.imageWidth=image.width;post.data.imageHeight=image.height;post.data.imageSrcSet=image.srcset;}
    if(post.data.socialImageUrl){const image=await optimize(post.data.socialImageUrl);post.data.socialImageUrl=image.url;post.data.socialImageWidth=image.width;post.data.socialImageHeight=image.height;}
    post.data.inlineImages={};
    for(const match of String(post.data.body||'').matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g))post.data.inlineImages[match[1]]=await optimize(match[1]);
  }
  const name=output.find(item=>item.id==='settings')?.data.name||'Portfolio';
  const svg=`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#f5f3ee"/><circle cx="1050" cy="130" r="220" fill="#3156eb"/><circle cx="1080" cy="520" r="140" fill="#ff916c"/><text x="90" y="270" font-family="sans-serif" font-size="70" font-weight="700" fill="#202329">${xml(name)}</text><text x="95" y="345" font-family="sans-serif" font-size="29" fill="#5f6b82">Projects, learning notes, and practical ideas.</text><text x="95" y="535" font-family="sans-serif" font-size="22" fill="#3156eb">${xml(new URL(origin).hostname)}</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir,'assets','social-default.png'));
  return output;
}
