import {esc} from './utils.js';

export const INTRO_DURATION=2200;
export function shouldPlayIntro({path='/',enabled=true,reduced=false,paused=false,played=false,force=false}={}){
  return enabled&&!reduced&&!paused&&!path.startsWith('/admin')&&(force||path==='/')&&(!played||force);
}
export function introHead(meta){
  if(new URL(meta.canonical).pathname!=='/'||meta.introEnabled===false)return '';
  return '<style>html.intro-pending::before{content:"";position:fixed;inset:0;background:#050505;z-index:10000;pointer-events:none}@media(prefers-reduced-motion:reduce){html.intro-pending::before{display:none}}</style><script src="/intro-boot.js"></script>';
}
function sword(id){
  return `<svg class="intro-katana" viewBox="0 0 1000 90" aria-hidden="true"><defs><linearGradient id="steel-${id}" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".38" stop-color="#b7cbdb"/><stop offset=".6" stop-color="#fff6e6"/><stop offset="1" stop-color="#76828e"/></linearGradient></defs><path d="M234 37 938 10 994 19C959 46 752 55 234 55Z" fill="url(#steel-${id})"/><path d="m244 53 670-21 70-12" fill="none" stroke="#fff7df" stroke-width="2"/><path d="M39 38h186v19H39z" fill="#15191f" stroke="#9f7650" stroke-width="2"/><path d="m45 39 19 16 19-16 19 16 19-16 19 16 19-16 19 16 19-16 19 16" fill="none" stroke="#d18b45" stroke-width="4"/><rect x="218" y="23" width="14" height="51" rx="5" fill="#b78448"/><path d="M234 39h21v17h-21z" fill="#eac38b"/><rect x="32" y="37" width="10" height="21" rx="3" fill="#c99b61"/></svg>`;
}
export function introMarkup(settings={}){
  return `<div class="intro-scene" aria-hidden="true"><div class="intro-shard intro-shard-top"></div><div class="intro-shard intro-shard-right"></div><div class="intro-shard intro-shard-bottom"></div><div class="intro-shard intro-shard-left"></div><div class="intro-signature"><span class="intro-overline">A CURIOUS MIND. A NEW PERSPECTIVE.</span><strong>${esc(settings.introTitle||settings.brand||'NABI')}<i>✦</i></strong><span class="intro-caption">${esc(settings.introCaption||'Curiosity. Craft. A little fire.')}</span></div>${['one','two'].map((id,index)=>`<div class="intro-cut intro-cut-${id}"><span class="intro-fire"></span><span class="intro-edge"></span><div class="intro-sword-flight">${sword(id)}</div>${Array.from({length:6},(_,i)=>`<i class="intro-ember ember-${i}" style="--ember:${i};--direction:${i%2?1:-1}"></i>`).join('')}</div>`).join('')}<span class="intro-impact"></span><span class="intro-corner">N / K<span>DESIGNED WITH INTENTION</span></span></div><button class="intro-skip" type="button" data-skip-intro>Skip intro <span>↗</span></button>`;
}
export function mountIntro(settings={}){
  const root=document.documentElement;const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=false;
  try{paused=localStorage.getItem('nabin-motion')==='paused';}catch{}
  let overlay;let finishTimer;let revealTimer;let frame;let alive=true;
  const reveal=()=>root.classList.add('page-arrived');
  function stop(){
    clearTimeout(finishTimer);clearTimeout(revealTimer);cancelAnimationFrame(frame);overlay?.remove();overlay=null;
    root.classList.remove('intro-pending','intro-playing');reveal();
  }
  function controls(){document.querySelectorAll('[data-replay-intro]').forEach(button=>{button.disabled=reduced.matches||paused;button.title=button.disabled?'Motion is paused':'Watch the katana reveal again';});}
  function play(force=false){
    let played=false;try{played=sessionStorage.getItem('nabin-katana-seen-v1')==='1';}catch{}
    if(!alive||!shouldPlayIntro({path:location.pathname,enabled:settings.introEnabled!==false,reduced:reduced.matches,paused,played,force})||(!force&&root.dataset.introExpired==='true')){stop();controls();return false;}
    stop();root.classList.remove('page-arrived');if(force)scrollTo({top:0,behavior:'instant'});
    overlay=document.createElement('div');overlay.className='katana-intro';overlay.id='katana-intro';overlay.innerHTML=introMarkup(settings);document.body.append(overlay);
    root.classList.remove('intro-pending');root.classList.add('intro-playing');
    try{sessionStorage.setItem('nabin-katana-seen-v1','1');}catch{}
    frame=requestAnimationFrame(()=>{if(overlay)overlay.classList.add('intro-running');});
    revealTimer=setTimeout(reveal,1100);finishTimer=setTimeout(stop,INTRO_DURATION);controls();return true;
  }
  const key=event=>{if(overlay&&['Escape','Tab'].includes(event.key))stop();};
  const click=event=>{if(event.target.closest('[data-skip-intro]'))stop();if(event.target.closest('[data-replay-intro]'))play(true);};
  const preference=()=>{if(reduced.matches)stop();controls();};
  const motion=event=>{paused=Boolean(event.detail?.paused);if(paused)stop();controls();};
  document.addEventListener('keydown',key);document.addEventListener('click',click);document.addEventListener('portfolio:motion',motion);reduced.addEventListener('change',preference);
  const replay=new URLSearchParams(location.search).has('intro');play(replay);controls();
  return {play,stop,destroy(){alive=false;stop();document.removeEventListener('keydown',key);document.removeEventListener('click',click);document.removeEventListener('portfolio:motion',motion);reduced.removeEventListener('change',preference);}};
}
