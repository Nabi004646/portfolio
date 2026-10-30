import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {routePolicy} from '../src/seo/route-policy.js';

const root=path.resolve('dist');let manifest;
try{manifest=JSON.parse(await readFile('functions/_generated/routes.json','utf8'));}catch{throw new Error('Run npm run build before previewing the generated site.');}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm'};
const headers={};
const headerText=await readFile(path.join(root,'_headers'),'utf8').catch(()=>'');let applies=false;for(const line of headerText.split('\n')){if(line==='/*'){applies=true;continue;}if(!line.startsWith(' ')&&line.trim()){applies=false;continue;}if(applies&&line.includes(':')){const index=line.indexOf(':');headers[line.slice(0,index).trim()]=line.slice(index+1).trim();}}
async function assets(request){
  const url=new URL(request.url);let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return new Response(manifest.errorHtml,{status:404,headers:{...headers,'Content-Type':'text/html'}});}
  let filename=path.resolve(root,'.'+pathname);if(!filename.startsWith(root+path.sep)&&filename!==root)return new Response('Not found',{status:404});
  try{const info=await stat(filename);if(info.isDirectory())filename=path.join(filename,'index.html');const bytes=await readFile(filename);return new Response(bytes,{headers:{...headers,'Content-Type':mime[path.extname(filename)]||'application/octet-stream'}});}catch{return new Response(manifest.errorHtml,{status:404,headers:{...headers,'Content-Type':'text/html'}});}
}
const server=http.createServer(async(req,res)=>{try{const origin=`http://${req.headers.host||'localhost'}`;const request=new Request(new URL(req.url,origin),{method:req.method==='HEAD'?'GET':req.method});const response=await routePolicy(request,manifest,assets);res.writeHead(response.status,Object.fromEntries(response.headers));if(req.method==='HEAD')res.end();else res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview error');}});
const port=Number(process.env.PORT||process.env.SITES_PORT||4173);server.listen(port,'0.0.0.0',()=>console.log(`Generated-site preview ready on port ${port}.`));
