import {icon} from './utils.js';

export function preferredTheme({saved,systemDark=false}={}){return ['light','dark'].includes(saved)?saved:systemDark?'dark':'light';}
export function readTheme(){
  let saved;try{saved=localStorage.getItem('nabin-theme');}catch{}
  return preferredTheme({saved,systemDark:matchMedia('(prefers-color-scheme: dark)').matches});
}
export function applyPalette(settings,root=document.documentElement){
  // Brand choices must never override the theme's semantic background/foreground.
  for(const [field,variable] of [['cream','--brand-paper'],['blue','--brand-blue'],['coral','--brand-coral']])if(/^#[a-f0-9]{6}$/i.test(settings?.[field]||''))root.style.setProperty(variable,settings[field]);
}
export function setTheme(value,{persist=false}={}){
  const theme=preferredTheme({saved:value});document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#111824':document.documentElement.style.getPropertyValue('--brand-paper')||'#f5f3ee');
  document.querySelectorAll('.theme-toggle').forEach(button=>{button.innerHTML=icon(theme==='dark'?'sun':'moon');button.setAttribute('aria-pressed',String(theme==='dark'));button.setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');button.title=theme==='dark'?'Switch to light mode':'Switch to dark mode';});
  if(persist)try{localStorage.setItem('nabin-theme',theme);}catch{}
  return theme;
}
