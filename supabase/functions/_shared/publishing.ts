import {db,env,originHeaders,json} from './runtime.ts';
import {HttpError} from './validation.ts';

export function equalSecret(actual:string,expected:string){
  if(expected.length<32||actual.length!==expected.length)return false;
  let difference=0;for(let index=0;index<expected.length;index++)difference|=actual.charCodeAt(index)^expected.charCodeAt(index);return difference===0;
}
export async function publishingHandler(request:Request,deps:{client?:ReturnType<typeof db>;getEnv?:typeof env;fetcher?:typeof fetch}={}){
  const getEnv=deps.getEnv||env;const fetcher=deps.fetcher||fetch;let headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin'};
  try{
    const hasOrigin=Boolean(request.headers.get('origin'));
    if(hasOrigin)headers=originHeaders(request);
    if(request.method==='OPTIONS'){if(!hasOrigin)throw new HttpError(403,'An allowed origin is required.');return new Response(null,{status:204,headers});}
    if(request.method!=='POST')throw new HttpError(405,'Use POST.');
    if(Number(request.headers.get('content-length')||'0')>4096)throw new HttpError(413,'The request is too large.');
    const client=deps.client||db();
    let stored:{deploy_hook?:string;webhook_secret?:string}={};
    const loadStored=async()=>{const {data,error}=await client.rpc('get_portfolio_publish_config');if(!error&&data)stored=data;};
    const shared=request.headers.get('x-publish-secret')||'';
    if(!hasOrigin&&shared.length>=32)await loadStored();
    const isWebhook=!hasOrigin&&(equalSecret(shared,getEnv('PUBLISH_WEBHOOK_SECRET'))||equalSecret(shared,stored.webhook_secret||''));
    if(!isWebhook){
      if(!hasOrigin)throw new HttpError(401,'Authentication is required.');
      const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)throw new HttpError(401,'Authentication is required.');
      const {data:verified,error}=await client.auth.getClaims(token);
      if(error||!verified?.claims?.sub||verified.claims.aal!=='aal2')throw new HttpError(403,'Verify your administrator second factor.');
      const {data:user,error:userError}=await client.auth.getUser(token);
      if(userError||user?.user?.id!==verified.claims.sub)throw new HttpError(403,'Your sign-in session could not be verified.');
      const {data:membership,error:memberError}=await client.from('admin_members').select('user_id').eq('user_id',verified.claims.sub).maybeSingle();
      if(memberError||!membership)throw new HttpError(403,'Administrator access is required.');
      await loadStored();
    }
    const rawHook=stored.deploy_hook||getEnv('CLOUDFLARE_DEPLOY_HOOK');let hook:URL;
    try{hook=new URL(rawHook);if(hook.protocol!=='https:'||hook.hostname!=='api.cloudflare.com'||!hook.pathname.startsWith('/client/v4/pages/webhooks/deploy_hooks/')||hook.username||hook.password)throw new Error();}
    catch{
      await client.from('publishing_status').update({state:'not_configured',last_error:'Cloudflare is not connected. Open Studio → Publishing and connect your production deploy hook.'}).eq('id',1);
      return json({ok:false,code:'publishing_not_configured',error:'Cloudflare is not connected. Open Studio → Publishing and connect your production deploy hook.'},503,headers);
    }
    const {data:batch,error:claimError}=await client.rpc('claim_publish_batch');
    if(claimError||!batch)throw new HttpError(503,'The publishing queue is unavailable.');
    if(!batch.count)return json({ok:true,state:'no_pending_changes',count:0},200,headers);
    let accepted=false;
    try{const response=await fetcher(hook.href,{method:'POST',signal:AbortSignal.timeout(15000),redirect:'error'});accepted=response.ok;}
    catch{accepted=false;}
    const {error:finishError}=await client.rpc('finish_publish_batch',{p_batch:batch.batch_id,p_success:accepted});
    if(!accepted)throw new HttpError(502,'The build request failed. Your content is saved; retry publishing after checking the server setup.');
    if(finishError)throw new HttpError(503,'The build request was accepted, but its queue status could not be saved. Check Cloudflare before retrying.');
    return json({ok:true,state:'requested',count:batch.count,message:'Build requested. This does not confirm a successful deployment.'},200,headers);
  }catch(error){return json({ok:false,error:error instanceof HttpError?error.message:'Publishing is temporarily unavailable.'},error instanceof HttpError?error.status:503,headers);}
}
