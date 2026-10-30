import {publishingHandler,equalSecret} from './publishing.ts';
import {db} from './runtime.ts';
const secret='test-only-scoped-webhook-secret-1234567890';
const hook='https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/test-only-hook';
const admin='11111111-1111-4111-8111-111111111111';
const assert=(condition:unknown,message='Assertion failed')=>{if(!condition)throw new Error(message);};
function setup(options:{aal?:string,member?:boolean,count?:number,accepted?:boolean,hook?:string}={}) {
  Deno.env.set('ALLOWED_ORIGINS','https://portfolio.test');
  const calls:{name:string,args?:unknown}[]=[];let requests=0;
  const client={auth:{
    getClaims:async()=>({data:{claims:{sub:admin,aal:options.aal||'aal2'}},error:null}),
    getUser:async()=>({data:{user:{id:admin}},error:null}),
  },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:options.member===false?null:{user_id:admin},error:null})})})}),
  rpc:async(name:string,args?:unknown)=>{calls.push({name,args});return {data:name==='claim_publish_batch'?{batch_id:'test-batch',count:options.count??1}:null,error:null};}
  } as unknown as ReturnType<typeof db>;
  const getEnv=(name:string)=>({PUBLISH_WEBHOOK_SECRET:secret,CLOUDFLARE_DEPLOY_HOOK:options.hook??hook}[name]||'');
  const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{assert(String(input)===hook);assert(init?.method==='POST');requests++;return new Response('{}',{status:options.accepted===false?500:200});}) as typeof fetch;
  const browser=(headers:Record<string,string>={})=>new Request('https://backend.test/request-publish',{method:'POST',headers:{origin:'https://portfolio.test',authorization:'Bearer test-token',...headers},body:'{}'});
  return {client,getEnv,fetcher,calls,browser,get requests(){return requests;}};
}
Deno.test('publishing rejects unsigned callers, weak factors, non-admin accounts, and wrong scoped secrets',async()=>{
  for(const options of [{aal:'aal1'},{member:false}]) {
    const deps=setup(options);const response=await publishingHandler(deps.browser(),deps);assert(response.status===403);assert(deps.requests===0&&deps.calls.length===0);
  }
  const deps=setup();
  for(const request of [new Request('https://backend.test',{method:'POST'}),new Request('https://backend.test',{method:'POST',headers:{'x-publish-secret':'wrong'}}),deps.browser({authorization:''})]) {
    const response=await publishingHandler(request,deps);assert(response.status===401);assert(deps.requests===0);
  }
  assert(equalSecret(secret,secret));assert(!equalSecret('short','short'));assert(!equalSecret('x'.repeat(secret.length),secret));
});
Deno.test('verified AAL2 administrators request one queued build without exposing the hook',async()=>{
  const deps=setup({count:3});const response=await publishingHandler(deps.browser(),deps);const body=await response.text();
  assert(response.status===200&&deps.requests===1);assert(body.includes('requested')&&!body.includes(hook));
  assert(deps.calls[0].name==='claim_publish_batch');assert(JSON.stringify(deps.calls[1].args).includes('"p_success":true'));
  assert(body.includes('does not confirm a successful deployment'));
});
Deno.test('database webhooks require the scoped secret and skip duplicate empty batches',async()=>{
  const deps=setup({count:0});const response=await publishingHandler(new Request('https://backend.test',{method:'POST',headers:{'x-publish-secret':secret}}),deps);
  assert(response.status===200&&deps.requests===0);assert((await response.json()).state==='no_pending_changes');
});
Deno.test('provider failure stays retryable and misconfigured destinations never receive requests',async()=>{
  const deps=setup({accepted:false});const response=await publishingHandler(deps.browser(),deps);const text=await response.text();
  assert(response.status===502&&text.includes('content is saved')&&!text.includes(hook));
  assert(JSON.stringify(deps.calls[1].args).includes('"p_success":false'));
  for(const bad of ['https://evil.test/hook','http://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/foo','https://api.cloudflare.com/other']){
    const deps=setup({hook:bad});const response=await publishingHandler(deps.browser(),deps);assert(response.status===503&&deps.requests===0&&deps.calls.length===0);
  }
});
