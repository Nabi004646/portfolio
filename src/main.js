import './fonts.css';
import './style.css';
import './intro.css';
import './theme.css';
import {applyPalette,readTheme,setTheme} from './theme.js';
import {mountIntro} from './intro.js';
import {createPublicViews} from './public-views.js';
import { mediaUrl } from './local-media.js';
import { certificateSection, bindCertificates } from './certificates.js';
import { defaultContent, getData, getRecord, byKind } from './content.js';
import { configured, loadContent, submitPublic, mountTurnstile } from './api.js';
import { uuid, esc, lines, icon, safeUrl, markdown, formatDate, toast } from './utils.js';

let items = structuredClone(defaultContent);
let offline = false;
let pageCleanup = () => {};
let animationCleanup = () => {};
let certificateCleanup = () => {};
let routeToken = 0;
let views;
const app = document.getElementById('app');
let lastPath = '';
let motionPaused = localStorage.getItem('nabin-motion') === 'paused';
let theme = setTheme(readTheme());
document.documentElement.dataset.theme = theme;
document.documentElement.classList.toggle('motion-paused', motionPaused);
const s = () => getData(items, 'settings');
const copy = section => (getData(items, 'ui-copy')[section] || getData(defaultContent, 'ui-copy')[section] || {});
const detail = section => getData(items, 'detail-copy')[section] || getData(defaultContent, 'detail-copy')[section] || {};
const certCopy = () => Object.keys(getData(items, 'certificates-settings')).length ? getData(items, 'certificates-settings') : getData(defaultContent, 'certificates-settings');
const layout = () => Object.keys(getData(items, 'layout')).length ? getData(items, 'layout') : getData(defaultContent, 'layout');
const cap = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback;
const accentedLines = text => String(text).split('\n').map((part,index) => index ? `<span>${esc(part)}</span>` : esc(part)).join('<br>');
const externalAttrs = url => (url.startsWith('https:') || url.startsWith('blob:')) ? 'target="_blank" rel="noopener noreferrer"' : 'data-link';
const buttonLink = (text, href, style = 'primary', arrow = 'diagonal') => {
  const target = (arrow === 'download' ? mediaUrl(href) : safeUrl(href)) || '/contact';
  return `<a class="button button-${style}" href="${esc(target)}" ${externalAttrs(target)} ${arrow === 'download' ? 'download' : ''}>${esc(text)}${icon(arrow)}</a>`;
};
const eyebrow = text => `<div class="eyebrow"><span></span>${esc(text)}</div>`;

function applySettings() {
  applyPalette(s());
  document.querySelector('meta[name="description"]').content = s().metaDescription || '';
}

async function bindContact() {
  const form = document.getElementById('contact-form'); if (!form) return;
  let captcha;
  try { captcha = await mountTurnstile(document.getElementById('contact-turnstile')); } catch (error) { document.getElementById('contact-error').textContent = error.message; }
  if (!form.isConnected) { captcha?.destroy(); return; }
  pageCleanup = () => captcha?.destroy();
  const fileInput = form.elements.attachment;
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { fileInput.value = ''; toast('Choose a PDF, JPG, PNG, or WebP under 5 MB.', true); }
    const selected = fileInput.files[0]; document.getElementById('attachment-name').textContent = selected ? `${selected.name} · ${selected.size < 1024 ? `${selected.size} B` : `${(selected.size / 1024).toFixed(0)} KB`}` : copy('contact').attachmentLabel;
    form.querySelector('.attachment-remove').hidden = !selected;
    document.getElementById('attachment-zone').classList.toggle('has-file', Boolean(selected));
  });
  form.querySelector('.attachment-remove').onclick = () => { fileInput.value = ''; fileInput.dispatchEvent(new Event('change')); };
  let requestId = uuid();
  form.addEventListener('input', () => { requestId = uuid(); });
  form.onsubmit = async event => {
    event.preventDefault(); const button = form.querySelector('[type="submit"]'); const error = document.getElementById('contact-error'); error.textContent = '';
    if (!configured) { error.textContent = 'Message delivery is unavailable right now. Please contact me by email instead. Your message has not been sent.'; return; }
    button.disabled = true; button.textContent = 'Sending your note…';
    try {
      const data = new FormData(form); data.set('requestId', requestId); data.set('consent', String(form.elements.consent.checked)); data.set('turnstileToken', captcha?.token() || '');
      const result = await submitPublic('submit-contact', data);
      const d = getData(items, 'contact'); form.innerHTML = `<div class="form-success"><div>${icon('check')}</div><h2>${esc(d.successTitle)}</h2><p>${esc(d.successText)}</p><span class="small-label">REFERENCE ${esc(result.id)}</span><a href="/projects" data-link class="button button-primary">Explore the work ${icon('diagonal')}</a></div>`; captcha?.destroy();
    } catch (e) { error.textContent = e.name === 'TimeoutError' ? 'That took longer than expected. Retry to check this submission without duplicating the email.' : e.message; captcha?.reset(); button.disabled = false; button.innerHTML = `${esc(getData(items, 'contact').submitLabel)}${icon('diagonal')}`; }
  };
}

function setupAnimations() {
  animationCleanup();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || motionPaused;
  const reveal = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); reveal.unobserve(entry.target); } }), { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
  let frame = 0;
  const elements = [...document.querySelectorAll('[data-parallax]')];
  const scroll = () => { if (frame || reduce) return; frame = requestAnimationFrame(() => { const y = Math.min(window.scrollY, 1200); elements.forEach(el => el.style.translate = `0 ${y * Number(el.dataset.parallax)}px`); frame = 0; }); };
  window.addEventListener('scroll', scroll, { passive: true });
  animationCleanup = () => { reveal.disconnect(); window.removeEventListener('scroll', scroll); cancelAnimationFrame(frame); };
}

function bindPage() {
  setTheme(theme);
  document.querySelector('.theme-toggle')?.addEventListener('click', () => {
    theme = setTheme(theme === 'light' ? 'dark' : 'light',{persist:true});
  });
  document.querySelector('.menu-toggle')?.addEventListener('click', event => {
    const nav = document.querySelector('.mobile-nav'); nav.hidden = !nav.hidden; event.currentTarget.setAttribute('aria-expanded', String(!nav.hidden));
  });
  document.getElementById('motion-toggle')?.addEventListener('click', () => {
    motionPaused = !motionPaused; document.dispatchEvent(new CustomEvent('portfolio:motion',{detail:{paused:motionPaused}})); localStorage.setItem('nabin-motion', motionPaused ? 'paused' : 'on'); document.documentElement.classList.toggle('motion-paused', motionPaused); document.getElementById('motion-toggle').setAttribute('aria-pressed', String(motionPaused)); document.getElementById('motion-toggle').textContent = motionPaused ? detail('general').motionPaused : detail('general').pauseMotion; setupAnimations(); certificateCleanup(); certificateCleanup = bindCertificates(byKind(items, 'certificate'), certCopy(), { motionPaused });
  });
  document.querySelectorAll('[data-project-filter]').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('[data-project-filter]').forEach(el => el.classList.toggle('active', el === btn));
    let projects = byKind(items, 'project'); if (btn.dataset.projectFilter === 'featured') projects = projects.filter(p => p.data.featured); if (btn.dataset.projectFilter.startsWith('category:')) projects = projects.filter(p => p.data.category === btn.dataset.projectFilter.slice(9));
    document.getElementById('project-results').innerHTML = projects.length ? projects.map(views.projectCard).join('') : `<p class="empty-state">${esc(detail('projects').empty)}</p>`; setupAnimations();
  });
  let blogCategory = 'all';
  const searchPosts = () => { const term = document.getElementById('blog-search')?.value.toLowerCase() || ''; const posts = byKind(items, 'post').filter(p => (blogCategory === 'all' || p.data.category === blogCategory) && `${p.title} ${p.data.excerpt} ${(p.data.tags || []).join(' ')}`.toLowerCase().includes(term)); document.getElementById('blog-results').innerHTML = posts.length ? posts.map(views.postCard).join('') : `<p class="empty-state">${esc(detail('blog').empty)}</p>`; setupAnimations(); };
  document.querySelectorAll('[data-blog-filter]').forEach(btn => btn.onclick = () => { blogCategory = btn.dataset.blogFilter; document.querySelectorAll('[data-blog-filter]').forEach(el => el.classList.toggle('active', el === btn)); searchPosts(); });
  document.getElementById('blog-search')?.addEventListener('input', searchPosts);
  document.getElementById('start-lab')?.addEventListener('click', () => openDemo(false));
  bindContact(); setupAnimations();
  certificateCleanup = bindCertificates(byKind(items, 'certificate'), certCopy(), { motionPaused });
}

async function openDemo(required = false) {
  const { openConsentDemo } = await import('./demo.js');
  openConsentDemo({ settings: s(), required, onDone: () => { sessionStorage.setItem('nabin-demo-complete', '1'); document.getElementById('main')?.removeAttribute('inert'); document.getElementById('main')?.removeAttribute('aria-hidden'); document.body.classList.remove('gate-active'); }, onCancel: () => { if (required) { document.getElementById('gate-reopen')?.removeAttribute('hidden'); } } });
}

async function render() {
  document.dispatchEvent(new Event('portfolio:navigate'));
  const token = ++routeToken;
  pageCleanup(); pageCleanup = () => {}; animationCleanup(); certificateCleanup();
  let path;
  try { path = decodeURI(location.pathname).replace(/\/$/, '') || '/'; } catch { path = '/invalid-path'; }
  const changed = path !== lastPath; lastPath = path;
  document.body.classList.toggle('admin-route', path.startsWith('/admin'));
  if (path.startsWith('/admin')) {
    const { mountAdmin } = await import('./admin.js');
    if (token !== routeToken) return;
    const cleanup = await mountAdmin(app, { items, refresh: async () => { items = await loadContent(true); return items; }, update: next => { items = next; applySettings(); } });
    if (token !== routeToken) cleanup(); else pageCleanup = cleanup;
    return;
  }
  applySettings();
  views=createPublicViews({items,configured,offline,theme,motionPaused});
  const {header,footer,home,aboutPage,projectsPage,projectDetail,blogPage,postDetail,contactPage,labPage,notFound,textPage,ctaSection}=views;
  let body, title;
  const coreId = { '/':'home', '/about':'about', '/contact':'contact' }[path];
  if (coreId && !getRecord(items, coreId)?.is_published) { body = notFound(); title = detail('general').notFoundTitle; }
  else if (path === '/') { body = home(); title = `${s().name} — ${s().role}`; }
  else if (path === '/about') { body = aboutPage(); title = 'About'; }
  else if (path === '/certificates') { const ui = certCopy(); body = `<section class="page-hero section"><div>${eyebrow(ui.eyebrow)}<h1>${accentedLines(ui.pageHeadline)}</h1></div><p>${esc(ui.intro)}</p></section>${certificateSection(byKind(items, 'certificate'), ui, {page:true})}${ctaSection()}`; title = ui.allLabel; }
  else if (path === '/projects') { body = projectsPage(); title = 'Projects'; }
  else if (path.startsWith('/projects/')) { body = projectDetail(path.split('/')[2]); title = byKind(items, 'project').find(p => p.slug === path.split('/')[2])?.title || 'Project'; }
  else if (path === '/blog') { body = blogPage(); title = 'Notes & blog'; }
  else if (path.startsWith('/blog/')) { body = postDetail(path.split('/')[2]); title = byKind(items, 'post').find(p => p.slug === path.split('/')[2])?.title || 'Article'; }
  else if (path === '/contact') { body = contactPage(); title = 'Contact'; }
  else if (path === '/lab') { body = labPage(); title = 'Camera & location lab'; }
  else { body = textPage(path.slice(1)); title = byKind(items, 'page').find(p => p.slug === path.slice(1))?.title || 'Page not found'; }
  document.title = path === '/' ? title : `${title} — ${s().name}`;
  app.innerHTML = `${header(path)}<main id="main" tabindex="-1">${body}</main>${footer()}<button class="motion-toggle" id="motion-toggle" aria-pressed="${motionPaused}">${esc(motionPaused ? detail('general').motionPaused : detail('general').pauseMotion)}</button><button id="gate-reopen" class="button button-primary gate-reopen" hidden>Start the demo ${icon('camera')}</button>`;
  if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
  bindPage();
  document.body.classList.remove('gate-active');
}

document.addEventListener('click', event => {
  if(!import.meta.env.DEV)return;
  const anchor = event.target.closest('a[data-link]');
  if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || anchor.target === '_blank') return;
  const url = new URL(anchor.href, location.origin); if (url.origin !== location.origin) return;
  event.preventDefault(); history.pushState({}, '', url.pathname + url.search + url.hash); render();
});
window.addEventListener('popstate', render);
window.addEventListener('beforeunload', () => { pageCleanup(); animationCleanup(); certificateCleanup(); });

try { items = await loadContent(); } catch { offline = true; }
await render();
const intro=mountIntro(s());
window.addEventListener('pagehide',()=>intro.destroy(),{once:true});
