import {visitHandler} from './visit.ts';
import {CONSENT_VERSION} from './validation.ts';
import {db} from './runtime.ts';
function assert(ok:unknown,message='Assertion failed'):asserts ok {if(!ok)throw new Error(message);}
const reference='835087fd-4826-4c04-8898-a788f95efe18';
const owner='owner@example.com';
const originalFetch=globalThis.fetch;
function setup(){
  for(const [key,value] of Object.entries({ALLOWED_ORIGINS:'https://portfolio.example',OWNER_EMAIL:owner,RESEND_API_KEY:'re_synthetic_mock_only',MAIL_FROM:'Portfolio <test@portfolio.example>',IP_HASH_SECRET:'a-synthetic-unit-test-hash-secret-1234567890',REQUIRE_TURNSTILE:'false'}))Deno.env.set(key,value);
}
function fixture(options:{email?:string;uploadFailure?:boolean}={}){
  const rows=new Map<string,Record<string,unknown>>();const uploads:{bucket:string;path:string;bytes:Uint8Array}[]=[];
  const client={
    rpc:async()=>({data:true,error:null}),
    from(table:string){
      return {
        async insert(row:Record<string,unknown>){if(rows.has(String(row.id)))return {error:{code:'23505'}};rows.set(String(row.id),{...row,email_status:'pending',created_at:new Date().toISOString()});return {error:null};},
        select(){let id='';return {eq(_key:string,value:string){id=value;return this;},async single(){return table==='content_items'?{data:{data:{email:options.email||owner}},error:null}:{data:rows.get(id)?{...rows.get(id)}:null,error:null};}};},
        update(values:Record<string,unknown>){let id='';let excluded='';const builder={eq(_key:string,value:string){id=value;return builder;},neq(_key:string,value:string){excluded=value;return builder;},then(resolve:(value:unknown)=>unknown){const row=rows.get(id);if(row&&row.email_status!==excluded)Object.assign(row,values);return Promise.resolve({error:null}).then(resolve);}};return builder;},
      };
    },
    storage:{from(bucket:string){return {async upload(path:string,bytes:Uint8Array){if(options.uploadFailure)return {error:{statusCode:'500',message:'Synthetic failure'}};uploads.push({bucket,path,bytes});return {error:null};}};}},
  } as unknown as ReturnType<typeof db>;
  return {client,rows,uploads};
}
function form(){
  const data=new FormData();
  for(const [key,value] of Object.entries({requestId:reference,consent:'true',consentVersion:CONSENT_VERSION,consentAt:new Date().toISOString(),consentText:'Continuing automatically captures one photo from the camera and requests your location. Both the photo and coordinates will be sent to the portfolio owner by email.',latitude:'0',longitude:'0',accuracy:'25',recipient:'untrusted-recipient@example.com'}))data.set(key,value);
  const bytes=new Uint8Array(32);bytes.set([255,216,255]);bytes.set([255,217],30);
  data.set('photo',new File([bytes],'capture.jpg',{type:'image/jpeg'}));return data;
}
const request=(data:FormData)=>new Request('https://backend.example/submit-visit',{method:'POST',headers:{origin:'https://portfolio.example','x-forwarded-for':'192.0.2.1'},body:data});

Deno.test('visit handler stores a private photo, emails the coordinates and attachment to the fixed owner, and confirms acceptance',async()=>{
  setup();const fake=fixture();let sent=0;const input=form();
  globalThis.fetch=async(url,options)=>{assert(url==='https://api.resend.com/emails');const email=JSON.parse(String(options?.body));sent++;assert(email.to.length===1&&email.to[0]===owner);assert(email.text.includes('Latitude: 0')&&email.text.includes('Longitude: 0')&&email.text.includes('Accuracy: ±25'));assert(email.attachments[0].filename==='capture.jpg');assert(atob(email.attachments[0].content).length===32);assert((options?.headers as Record<string,string>)['Idempotency-Key']===`visit/${reference}`);return new Response(JSON.stringify({id:'synthetic-provider-id'}));};
  try{
    const response=await visitHandler(request(input),fake);assert(response.status===200);const result=await response.json();assert(result.ok&&result.status==='accepted'&&result.id===reference);
    assert(fake.uploads.length===1&&fake.uploads[0].bucket==='portfolio-private');assert(fake.rows.get(reference)?.email_status==='accepted');
    const retry=await visitHandler(request(input),fake);assert(retry.status===200&&sent===1&&fake.uploads.length===1,'An accepted retry must not send another email');
  }finally{globalThis.fetch=originalFetch;}
});
Deno.test('visit handler rejects missing consent, malformed coordinates and missing photos before uploading or emailing',async()=>{
  setup();let sent=0;globalThis.fetch=async()=>{sent++;return new Response('{}');};
  try{for(const [key,value] of [['consent','false'],['latitude','91'],['photo','']]){const fake=fixture();const data=form();data.set(key,value);const response=await visitHandler(request(data),fake);assert(response.status===400);assert(!fake.uploads.length&&sent===0);}}finally{globalThis.fetch=originalFetch;}
});
Deno.test('visit handler reports provider rejection as failure and keeps the same reference retryable',async()=>{
  setup();const fake=fixture();const input=form();let accepted=false;
  globalThis.fetch=async()=>accepted?new Response(JSON.stringify({id:'synthetic-provider-id'})):new Response('{}',{status:500});
  try{let response=await visitHandler(request(input),fake);assert(response.status===502&&!(await response.json()).ok);assert(fake.rows.get(reference)?.email_status==='failed');accepted=true;response=await visitHandler(request(input),fake);assert(response.status===200&&fake.rows.get(reference)?.email_status==='accepted');}finally{globalThis.fetch=originalFetch;}
});
Deno.test('owner mismatch or a private-storage failure cannot produce a sent confirmation',async()=>{
  setup();let sent=0;globalThis.fetch=async()=>{sent++;return new Response(JSON.stringify({id:'never'}));};
  try{for(const options of [{email:'different@example.com'},{uploadFailure:true}]){const response=await visitHandler(request(form()),fixture(options));assert(response.status===503&&!(await response.json()).ok&&sent===0);}}finally{globalThis.fetch=originalFetch;}
});
