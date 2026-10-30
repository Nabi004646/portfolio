import {esc,icon} from './utils.js';
import {isEntranceRoute} from './entrance-policy.js';

export const ENTRANCE_KEY='nabin-entrance-reference-v1';
export function acceptedSubmission(result){
  return result?.status==='accepted'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result?.id||'');
}
export function requiresEntrance({path='/',required=false,reference=''}={}){
  return required===true&&isEntranceRoute(path)&&!acceptedSubmission({status:'accepted',id:reference});
}

export function mountEntrance(settings={}, {onAccepted=()=>{},loadDemo=()=>import('./demo.js')}={}){
  let reference='';try{reference=sessionStorage.getItem(ENTRANCE_KEY)||'';}catch{}
  const required=settings.entranceRequired&&document.documentElement.dataset.entrance!=='off';
  if(!requiresEntrance({path:location.pathname,required,reference})){
    document.documentElement.classList.remove('entrance-pending');
    return {required:false,destroy(){}};
  }
  const root=document.documentElement,app=document.getElementById('app');
  root.classList.remove('intro-pending');root.classList.add('entrance-pending');
  app.inert=true;app.setAttribute('aria-hidden','true');
  const gate=document.createElement('section');gate.className='entrance-gate';gate.setAttribute('aria-label','Website entrance');
  gate.innerHTML=`<div class="entrance-card"><span class="small-label">${esc(settings.brand||settings.name||'Portfolio')}</span><h1>Before we begin.</h1><p>Entering this portfolio requires a camera photo and location submission. Both are emailed to ${esc(settings.demoRecipientLabel||settings.name||'the portfolio owner')}${settings.email?` (${esc(settings.email)})`:''}.</p><p>No capture starts until you choose Agree &amp; Start and allow the browser permissions. If you do not agree, leave this page.</p><p id="entrance-status" role="status">Loading capture controls…</p><button class="button button-primary" id="entrance-retry" disabled>Open consent prompt ${icon('arrow')}</button><a href="/privacy/">Read privacy details</a></div>`;
  document.body.append(gate);
  const button=gate.querySelector('#entrance-retry'),status=gate.querySelector('#entrance-status');
  let alive=true,closeDemo,opening=false;
  function remain(){if(!alive)return;gate.inert=false;app.inert=true;app.setAttribute('aria-hidden','true');button.disabled=false;status.textContent='Entry is paused. Reopen the consent prompt to retry, or leave this page.';button.focus();}
  async function open(){
    if(!alive||opening)return;opening=true;button.disabled=true;
    try{
      const {openConsentDemo}=await loadDemo();if(!alive)return;
      gate.inert=true;
      closeDemo=openConsentDemo({settings,required:true,onCancel:remain,onDone:result=>{
        if(!alive)return;
        if(!acceptedSubmission(result)){remain();return;}
        try{sessionStorage.setItem(ENTRANCE_KEY,result.id);}catch{}
        alive=false;gate.remove();root.classList.remove('entrance-pending');app.inert=false;app.removeAttribute('aria-hidden');onAccepted();
      }});
    }catch{if(alive){remain();status.textContent='Capture controls could not load. Check your connection and retry. Nothing was captured or submitted.';}}
    finally{opening=false;}
  }
  button.onclick=open;open();
  return {required:true,destroy(){alive=false;closeDemo?.();gate.remove();}};
}
