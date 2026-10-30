import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ENTRANCE_KEY,acceptedSubmission,requiresEntrance,mountEntrance} from '../src/entrance.js';

const reference='33333333-3333-4333-8333-333333333333';
test('all public portfolio routes require entrance, with legal and admin exceptions',()=>{
  assert.equal(requiresEntrance({required:true}),true);
  for(const path of ['/blog','/blog/','/blog/article/','/blog/page/2/','/blog/category/linux/','/blog/tag/android/','/blog/search/','/projects/','/projects/demo/','/about/','/contact/','/certificates/','/author/nabin-kunwar/']){
    assert.equal(requiresEntrance({path,required:true}),true,path);
    assert.equal(requiresEntrance({path,required:true,reference}),false,path);
    assert.equal(requiresEntrance({path,required:true,reference:'forged-text'}),true,path);
  }
  for(const path of ['/admin','/admin/','/admin/login/','/privacy','/privacy/','/terms/','/lab/','/404.html','/410.html'])assert.equal(requiresEntrance({path,required:true}),false,path);
  assert.equal(requiresEntrance({required:false}),false);
  assert.equal(requiresEntrance({required:true,reference}),false);
  for(const result of [undefined,{status:'accepted',id:'local-test'},{status:'failed',id:reference}])assert.equal(acceptedSubmission(result),false);
  assert.equal(acceptedSubmission({status:'accepted',id:reference}),true);
});

test('cancelled and failed direct blog entrance never reveals content or starts the intro',async()=>{
  const saved=Object.fromEntries(['document','location','sessionStorage'].map(key=>[key,globalThis[key]]));
  const values=new Map(),classes=new Set();let accepted=0,callbacks,removed=false;
  const attrs=new Map(),app={inert:false,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
  const button={disabled:false,focus(){this.focused=true;}},status={textContent:''};
  const gate={setAttribute(){},querySelector:selector=>selector==='#entrance-retry'?button:status,remove(){removed=true;}};
  try{
    globalThis.location={pathname:'/blog/'};
    globalThis.sessionStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
    globalThis.document={documentElement:{dataset:{entrance:'required'},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},getElementById:()=>app,createElement:()=>gate,body:{append(){}}};
    const control=mountEntrance({entranceRequired:true,name:'Owner',email:'owner@example.com'},{onAccepted:()=>accepted++,loadDemo:async()=>({openConsentDemo:options=>{callbacks=options;return ()=>{};}})});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(control.required,true);assert.equal(callbacks.required,true);
    assert.equal(app.inert,true);assert.equal(attrs.get('aria-hidden'),'true');
    assert.ok(!gate.innerHTML.includes('Skip'));assert.ok(gate.innerHTML.includes('emailed'));
    callbacks.onCancel();assert.equal(app.inert,true);assert.equal(accepted,0);assert.equal(values.has(ENTRANCE_KEY),false);
    callbacks.onDone({status:'failed',id:reference});assert.equal(app.inert,true);assert.equal(accepted,0);
    callbacks.onDone({status:'accepted',id:reference});assert.equal(app.inert,false);assert.equal(attrs.has('aria-hidden'),false);
    assert.equal(classes.has('entrance-pending'),false);assert.equal(values.get(ENTRANCE_KEY),reference);assert.equal(removed,true);assert.equal(accepted,1);
    callbacks.onDone({status:'accepted',id:reference});assert.equal(accepted,1);
    control.destroy();
  }finally{for(const [key,value] of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('the entrance paint guard holds before animation even with reduced motion and an already-seen intro',async()=>{
  const source=await readFile('public/intro-boot.js','utf8');
  for(const path of ['/','/blog','/blog/','/blog/article/','/projects/'])for(const stored of ['', 'invalid', reference, 'blocked']){
    const classes=new Set();
    const root={dataset:{entrance:'required'},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};
    vm.runInNewContext(source,{document:{documentElement:root},location:{pathname:path,search:''},sessionStorage:{getItem:key=>{if(stored==='blocked')throw new Error('Storage blocked');return key===ENTRANCE_KEY?stored:'1';}},localStorage:{getItem:()=>null},matchMedia:()=>({matches:true}),URLSearchParams,setTimeout:()=>{throw new Error('The animation fallback must not unlock a pending entrance');}});
    assert.equal(classes.has('entrance-pending'),stored!==reference,`${path} (${stored})`);assert.equal(classes.has('intro-pending'),false);
  }
});
