import './fonts.css';
import './style.css';
import './intro.css';
import './theme.css';
import {applyPalette,readTheme,setTheme} from './theme.js';
import {mountIntro} from './intro.js';
import {mountEntrance} from './entrance.js';
import {bindCertificates} from './certificates.js';
import {esc,icon} from './utils.js';

document.documentElement.classList.replace('no-js','js');
const payload=JSON.parse(document.getElementById('public-page-data')?.textContent||'{}');
let intro;
const entrance=mountEntrance(payload.settings||{},{onAccepted:()=>{intro=mountIntro(payload.settings||{},{force:true});}});
if(!entrance.required)intro=mountIntro(payload.settings||{});
let motionPaused=localStorage.getItem('nabin-motion')==='paused';
let theme=setTheme(readTheme());
document.documentElement.classList.toggle('motion-paused',motionPaused);
applyPalette(payload.settings);
document.querySelector('.theme-toggle')?.addEventListener('click',()=>{theme=setTheme(theme==='dark'?'light':'dark',{persist:true});});
document.querySelector('.menu-toggle')?.addEventListener('click',event=>{const nav=document.querySelector('.mobile-nav');nav.hidden=!nav.hidden;event.currentTarget.setAttribute('aria-expanded',String(!nav.hidden));});
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.06});
document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));
let frame=0;const parallax=[...document.querySelectorAll('[data-parallax]')];
window.addEventListener('scroll',()=>{if(frame||motionPaused||reduced.matches)return;frame=requestAnimationFrame(()=>{const y=Math.min(scrollY,1200);parallax.forEach(element=>element.style.translate=`0 ${y*Number(element.dataset.parallax)}px`);frame=0;});},{passive:true});
let closeCertificates=()=>{};
if(payload.certificates?.length&&document.querySelector('[data-certificate-carousel]')){
  // The carousel code is separate from the authentication SDK and camera model.
  closeCertificates=bindCertificates(payload.certificates,payload.certificateCopy,{motionPaused});
}
const motionButton=document.createElement('button');motionButton.className='motion-toggle';motionButton.setAttribute('aria-pressed',String(motionPaused));
function labelMotion(){motionButton.textContent=motionPaused?(payload.motionLabels?.motionPaused||'Motion paused'):(payload.motionLabels?.pauseMotion||'Pause motion');}
labelMotion();motionButton.onclick=()=>{motionPaused=!motionPaused;document.dispatchEvent(new CustomEvent('portfolio:motion',{detail:{paused:motionPaused}}));localStorage.setItem('nabin-motion',motionPaused?'paused':'on');document.documentElement.classList.toggle('motion-paused',motionPaused);motionButton.setAttribute('aria-pressed',String(motionPaused));labelMotion();closeCertificates();if(payload.certificates?.length&&document.querySelector('[data-certificate-carousel]'))closeCertificates=bindCertificates(payload.certificates,payload.certificateCopy,{motionPaused});};document.body.append(motionButton);
document.querySelectorAll('[data-copy-code]').forEach(button=>{button.hidden=false;button.onclick=async()=>{const code=button.closest('.code-block').querySelector('code').textContent;try{await navigator.clipboard.writeText(code);button.textContent='Copied';setTimeout(()=>{button.textContent='Copy code';},1800);}catch{button.textContent='Select the code to copy';}};});
document.querySelectorAll('[data-project-filter]').forEach(button=>{button.setAttribute('aria-pressed',String(button.classList.contains('active')));button.onclick=()=>{
  const filter=button.dataset.projectFilter;
  document.querySelectorAll('[data-project-filter]').forEach(control=>{control.classList.toggle('active',control===button);control.setAttribute('aria-pressed',String(control===button));});
  document.querySelectorAll('#project-results .project-card').forEach(card=>{card.hidden=filter==='featured'?card.dataset.projectFeatured!=='true':filter.startsWith('category:')?card.dataset.projectCategory!==filter.slice(9):false;});
};});
// Contact code, including the Supabase SDK, loads only on the contact page.
if(document.getElementById('contact-form'))import('./public-contact.js').then(module=>module.bindPublicContact());
if(location.pathname==='/blog/search/'){
  const input=document.getElementById('public-search');const term=(new URLSearchParams(location.search).get('q')||'').slice(0,100);input.value=term;
  if(term.trim())fetch('/search-index.json').then(response=>response.json()).then(posts=>{const matches=posts.filter(post=>`${post.title} ${post.excerpt} ${post.category}`.toLowerCase().includes(term.toLowerCase()));document.getElementById('search-status').textContent=`${matches.length} result${matches.length===1?'':'s'} for “${term}”.`;document.getElementById('search-results').innerHTML=matches.map(post=>`<article class="article-card"><a href="${esc(post.url)}"><span class="small-label">${esc(post.category)}</span><h2>${esc(post.title)}</h2><p>${esc(post.excerpt)}</p></a></article>`).join('');}).catch(()=>{document.getElementById('search-status').textContent='Search is temporarily unavailable. Browse the blog archive instead.';});
}
window.addEventListener('pagehide',()=>{observer.disconnect();closeCertificates();cancelAnimationFrame(frame);entrance.destroy();intro?.destroy();});

window.addEventListener('pageshow',event=>{if(event.persisted&&entrance.required)location.reload();});
