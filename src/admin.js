import {seoPanel,updateSeoPreview,publishingIssues} from './seo/admin-preview.js';
import {ARTICLE_DEFAULTS,seoSettings} from './seo/model.js';
import {articleView} from './seo/blog-views.js';
import { configured, supabase, loadContent, saveContent, removeContent, uploadMedia, listMedia, deleteMedia, isAdminSession, requestPublishing, publishingNotice } from './api.js';
import { mediaUrl } from './local-media.js';
import { defaultContent, baseKinds, getData } from './content.js';
import { uuid, esc, icon, safeUrl, slugify, toast } from './utils.js';

const labels = { settings: 'Site settings', home: 'Home page', about: 'About page', skills: 'Skills & toolkit', contact: 'Contact page', page: 'Legal & extra pages', project: 'Project', post: 'Article', certificate: 'Certificate' };
const arrayDefaults = { nav: { label: 'New link', href: '/' }, links: {label:'New link',href:'/'}, personalLinks: {label:'New profile',handle:'',icon:'external',url:'https://'}, socialLinks: {label:'New profile',url:'https://',icon:'external'}, homeSections: {section:'certificates',visible:true}, services: { icon: 'code', title: 'New service', description: '' }, principles: { title: 'New principle', description: '' }, journey: { label: '', title: 'Next step', description: '' }, groups: { title: 'New group', items: ['New skill'] }, faqs: { question: 'New question', answer: '' }, sources: {label:'Source title',url:'https://'} };
const homeSectionNames = ['hero','ribbon','projects','about','services','skills','certificates','blog','contact'];
const human = key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const atPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function putPath(object, path, value) { const keys = path.split('.'); const last = keys.pop(); const parent = keys.reduce((target, key) => target[key], object); parent[last] = value; }

function fields(value, path = 'data', depth = 0) {
  return Object.entries(value).map(([key, item]) => {
    const fieldPath = `${path}.${key}`;
    if (Array.isArray(item)) return `<fieldset class="cms-array"><legend>${esc(human(key))} <span>${item.length}</span></legend>${item.map((entry, index) => `<div class="cms-array-item"><div class="cms-array-item-top"><span>${esc(human(key))} / ${index + 1}</span><div class="array-row-actions"><button class="icon-button" type="button" data-move-array="${esc(fieldPath)}" data-index="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="Move ${esc(human(key))} ${index + 1} up">↑</button><button class="icon-button" type="button" data-move-array="${esc(fieldPath)}" data-index="${index}" data-direction="1" ${index === item.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(human(key))} ${index + 1} down">↓</button><button class="icon-button" type="button" data-remove-array="${esc(fieldPath)}" data-index="${index}" aria-label="Remove ${esc(human(key))} ${index + 1}">${icon('close')}</button></div></div>${typeof entry === 'object' && entry !== null ? fields(entry, `${fieldPath}.${index}`, depth + 1) : inputField(String(index), entry, `${fieldPath}.${index}`, true)}</div>`).join('')}<button type="button" class="small-button" data-add-array="${esc(fieldPath)}">${icon('plus')}Add ${esc(human(key))}</button></fieldset>`;
    if (item !== null && typeof item === 'object') return `<fieldset class="cms-array"><legend>${esc(human(key))}</legend>${fields(item, fieldPath, depth + 1)}</fieldset>`;
    return inputField(key, item, fieldPath);
  }).join('');
}
function inputField(key, value, path, noLabel = false) {
  const label = noLabel ? 'Text' : human(key);
  if (key === 'section') return `<label>Section<select name="${esc(path)}">${homeSectionNames.map(name => `<option value="${name}" ${value === name ? 'selected' : ''}>${esc(human(name))}</option>`).join('')}</select></label>`;
  if (['imageUrl', 'portraitUrl', 'resumeUrl', 'socialImageUrl'].includes(key)) {
    const pdf = key === 'resumeUrl'; const source = mediaUrl(value);
    return `<div class="asset-editor field-wide"><label>${esc(label)}<input name="${esc(path)}" value="${esc(value || '')}" maxlength="2000" placeholder="Upload a file or paste an HTTPS URL"></label><div class="asset-editor-preview" data-asset-preview="${esc(path)}">${source ? pdf ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${icon('file')}Preview résumé</a>` : `<img src="${esc(source)}" alt="${esc(label)} preview">` : '<span>No file selected</span>'}</div><div class="asset-editor-actions"><button type="button" class="small-button" data-upload-asset="${esc(path)}">${icon('upload')}${source ? 'Replace' : 'Upload'} ${pdf ? 'PDF' : 'image'}</button><button type="button" class="small-button" data-remove-asset="${esc(path)}">Remove file from this content</button><input type="file" data-asset-file="${esc(path)}" ${pdf ? 'accept=".pdf"' : 'accept=".jpg,.jpeg,.png,.webp"'} hidden></div><small>Up to 5 MB. ${pdf ? 'PDF résumé.' : 'JPG, PNG, or WebP image.'} ${configured ? 'Saved to your portfolio media.' : 'Saved in this browser for local preview.'}</small></div>`;
  }
  if (typeof value === 'boolean') return `<label class="cms-check"><input type="checkbox" name="${esc(path)}" ${value ? 'checked' : ''} data-value-type="boolean"><span>${esc(label)}</span></label>`;
  if (typeof value === 'number') return `<label>${esc(label)}<input type="number" name="${esc(path)}" value="${value}" data-value-type="number"></label>`;
  if (/^(body|story|intro|description|.*Text|headline|accentLine|contactTitle|title)$/i.test(key) && String(value).length > 90 || /^(body|story|.*Text)$/i.test(key) || String(value).includes('\n')) return `<label class="field-wide">${esc(label)}${key === 'body' ? '<small>Plain text with ## headings and blank lines. HTML is escaped.</small>' : ''}<textarea name="${esc(path)}" rows="${key === 'body' || key === 'story' ? 10 : 3}" maxlength="50000">${esc(value ?? '')}</textarea></label>`;
  if (/^(cream|blue|coral)$/.test(key)) return `<label>${esc(label)} <small>60 / 30 / 10 palette</small><input name="${esc(path)}" type="color" value="${esc(value)}"></label>`;
  return `<label>${esc(label)}<input name="${esc(path)}" ${['date','issuedDate'].includes(key) ? 'type="date"' : 'type="text"'} value="${esc(value ?? '')}" maxlength="2000">${/Url$/.test(key) ? '<small>Use an HTTPS URL from Media, or a /local-path.</small>' : ''}</label>`;
}

export async function mountAdmin(root, ctx) {
  if(!configured&&!__PORTFOLIO_PREVIEW__){root.innerHTML='<main id="main" class="admin-auth"><section class="auth-card"><h1>Studio unavailable</h1><p>Administrator authentication has not been configured.</p><a href="/">Back to portfolio</a></section></main>';return ()=>{};}
  let disposed = false, currentItems = ctx.items, tab = 'overview', editing = null, inactivity;
  let authUnsubscribe;
  const owner = () => getData(currentItems, 'settings');
  const cleanup = () => { disposed = true; clearTimeout(inactivity); document.removeEventListener('pointerdown', activity); document.removeEventListener('keydown', activity); document.removeEventListener('portfolio:navigate',cleanup); authUnsubscribe?.(); };
  document.addEventListener('portfolio:navigate', cleanup, {once:true});

  function activity() { clearTimeout(inactivity); if (configured) inactivity = setTimeout(async () => { if (!disposed) { await supabase.auth.signOut({ scope: 'local' }); login('Session locked after 15 minutes of inactivity.'); } }, 15 * 60 * 1000); }
  function login(message = '') {
    if (disposed) return;
    document.querySelector('.skip-link')?.setAttribute('href','#main');
    root.innerHTML = `<main id="main" tabindex="-1" class="admin-auth"><a href="/" data-link class="brand">${esc(owner().brand || 'Nabin')}<span>®</span></a><section class="auth-card glass-panel"><div class="auth-icon">${icon('lock')}</div><span class="small-label">PRIVATE CONTENT STUDIO</span><h1>Your corner<br>of the internet.</h1><p>Sign in to manage your portfolio. Your authenticator is the second key.</p>${message ? `<p class="form-error" role="alert">${esc(message)}</p>` : ''}${configured ? `<form id="admin-signin"><label>Email address<input type="email" name="email" autocomplete="username" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required minlength="12"></label><p class="form-error" id="auth-error" role="alert"></p><button class="button button-primary" type="submit">Sign in securely ${icon('arrow')}</button></form><p class="auth-foot">Administrator access only. Password + authenticator.</p>` : `<div class="local-warning">Supabase isn’t connected yet. Explore the Studio locally; content and image uploads stay in this browser and do not change a live site. Secure sign-in becomes available after setup.</div><button id="preview-admin" class="button button-primary">Explore local Studio ${icon('arrow')}</button>`}<a href="/" data-link class="back-link">← Back to portfolio</a></section><span class="auth-decoration">✳</span></main>`;
    document.title = `Private Studio — ${owner().name || 'Nabin'}`;
    root.querySelector('#preview-admin')?.addEventListener('click', () => { tab = 'overview'; shell(); });
    root.querySelector('#admin-signin')?.addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); const error = root.querySelector('#auth-error'); button.disabled = true; error.textContent = '';
      try {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
        form.password.value = ''; if (authError) throw new Error('Sign-in failed. Check your credentials and try again.');
        const { data: { user } } = await supabase.auth.getUser();
        const { data: member, error: memberError } = await supabase.from('admin_members').select('user_id').eq('user_id', user.id).maybeSingle();
        if (memberError || !member) { await supabase.auth.signOut({ scope: 'local' }); throw new Error('This account is not a portfolio administrator.'); }
        await mfa();
      } catch (e) { if (!disposed && error.isConnected) { error.textContent = e.message; button.disabled = false; } }
    });
  }

  async function mfa() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: membership } = user ? await supabase.from('admin_members').select('user_id').eq('user_id', user.id).maybeSingle() : { data: null };
    if (!membership) { await supabase.auth.signOut({scope:'local'}); return login('This account is not a portfolio administrator.'); }
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return login('Could not load your authentication factors. Please sign in again.');
    let factor = data.totp.find(item => item.status === 'verified');
    let enrollment;
    if (!factor) {
      // Remove only abandoned, unverified TOTP enrollments to allow a clean retry.
      for (const unfinished of data.totp.filter(item => item.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: unfinished.id });
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Portfolio Studio', issuer: 'Nabin Portfolio' });
      if (enrollError) return login('Authenticator enrollment could not start. Try signing in again.');
      enrollment = enrolled; factor = enrolled;
    }
    if (disposed) return;
    const qr = enrollment?.totp.qr_code;
    const qrSource = qr ? qr.startsWith('data:image/') ? qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}` : '';
    root.innerHTML = `<main id="main" tabindex="-1" class="admin-auth"><a class="brand" data-link href="/">${esc(owner().brand)}<span>®</span></a><section class="auth-card glass-panel"><div class="auth-icon">${icon('shield')}</div><span class="small-label">SECOND FACTOR</span><h1>${enrollment ? 'Your second key.' : 'One more step.'}</h1><p>${enrollment ? 'Scan this QR code in your authenticator, then enter its 6-digit code to activate protection.' : 'Enter the current 6-digit code from your authenticator app.'}</p>${enrollment ? `<img class="totp-qr" src="${esc(qrSource)}" alt="Authenticator enrollment QR code"><details class="totp-manual"><summary>Use a manual setup key</summary><code>${esc(enrollment.totp.secret)}</code></details>` : ''}<form id="mfa-form"><label>Authenticator code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" required autofocus></label><p class="form-error" id="mfa-error" role="alert"></p><button type="submit" class="button button-primary">Verify & open Studio ${icon('arrow')}</button></form><button class="text-link" id="mfa-signout">Sign out</button><p class="auth-foot">Content and private records remain locked until verification succeeds.</p></section></main>`;
    root.querySelector('#mfa-form').onsubmit = async event => {
      event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: event.currentTarget.code.value });
      if (disposed) return;
      if (verifyError) { root.querySelector('#mfa-error').textContent = 'That code didn’t verify. Try the newest code from your app.'; button.disabled = false; return; }
      if (!await isAdminSession()) return login('This session does not have administrator access.');
      const next = await loadContent(true); if (disposed) return; currentItems = next; ctx.update(currentItems); shell();
    };
    root.querySelector('#mfa-signout').onclick = async () => { await supabase.auth.signOut({ scope: 'local' }); login(); };
  }

  function shell() {
    if (disposed) return;
    document.querySelector('.skip-link')?.setAttribute('href','#studio-content');
    activity();
    root.innerHTML = `<div class="studio-shell"><aside class="studio-sidebar"><a class="brand" href="/" data-link>${esc(owner().brand || 'Nabin')}<span>®</span></a><span class="studio-caption">CONTENT STUDIO</span><nav aria-label="Studio navigation">${[['overview', 'grid', 'Overview'], ['content', 'layers', 'Pages & settings'], ['projects', 'code', 'Projects'], ['blog', 'book', 'Blog'], ['certificates', 'shield', 'Certificates'], ['media', 'file', 'Media library'], ['inbox', 'mail', 'Messages'], ['visits', 'camera', 'Demo records'], ['publishing','upload','Publishing'], ['security', 'shield', 'Security']].map(([id, ico, label]) => `<button class="studio-nav ${tab === id ? 'active' : ''}" data-tab="${id}">${icon(ico)}${label}</button>`).join('')}</nav><div class="sidebar-bottom"><a href="/" data-link>${icon('external')}View portfolio</a><button id="admin-signout">${icon('logout')}${configured ? 'Sign out' : 'Leave preview'}</button><span class="studio-lock">${icon(configured ? 'shield' : 'eye')}${configured ? 'Two-factor verified' : 'Local preview'}</span></div></aside><div class="studio-main"><header class="studio-topbar"><span>${esc(owner().name || 'Nabin Kunwar')} <small>/ Portfolio Studio</small></span><span class="studio-session"><i></i>${configured ? 'Secure session' : 'Local preview'}</span></header>${!configured ? '<div class="studio-preview-banner">Local preview · content and media are saved in this browser. Private messages, email, and real authentication need Supabase setup.</div>' : ''}<main id="studio-content" tabindex="-1"></main></div></div>`;
    root.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { editing = null; tab = button.dataset.tab; shell(); });
    root.querySelector('#admin-signout').onclick = async () => { if (configured) await supabase.auth.signOut({ scope: 'local' }); login(); };
    renderTab();
  }

  function heading(title, description, action = '') { return `<div class="studio-page-heading"><div><span class="small-label">YOUR SPACE, YOUR WAY</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</div>`; }

  async function renderTab() {
    const content = root.querySelector('#studio-content'); if (!content) return;
    if (editing) return editor(editing);
    if (tab === 'overview') {
      content.innerHTML = heading('Make yourself at home.', 'A small studio for everything on your portfolio.') + `<div class="studio-stats">${[['Pages & settings', currentItems.filter(i => baseKinds.includes(i.kind) || i.kind === 'page').filter(i => i.is_published).length, 'layers'], ['Projects', currentItems.filter(i => i.kind === 'project').length, 'code'], ['Articles', currentItems.filter(i => i.kind === 'post').length, 'book'], ['Certificates', currentItems.filter(i => i.kind === 'certificate').length, 'shield']].map(([label, count, ico]) => `<div>${icon(ico)}<strong>${count}</strong><span>${label}</span></div>`).join('')}</div><div class="studio-welcome"><div><span class="small-label">LET’S MAKE IT YOURS</span><h2>Your work deserves<br>a good home.</h2><p>Update your introduction, add a project, or replace the sample articles with your own voice.</p><button class="button button-primary" id="edit-home">Edit the home page ${icon('arrow')}</button></div><span>✳</span></div><div class="studio-quick-actions"><button data-quick="projects">${icon('code')}Add a project${icon('diagonal')}</button><button data-quick="blog">${icon('book')}Write a note${icon('diagonal')}</button><button data-quick="security">${icon('shield')}Review security${icon('diagonal')}</button></div>`;
      content.querySelector('#edit-home').onclick = () => editor(structuredClone(currentItems.find(i => i.id === 'home') || defaultContent.find(i=>i.id==='home')));
      content.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => { tab = b.dataset.quick; shell(); });
    } else if (['content', 'projects', 'blog', 'certificates'].includes(tab)) {
      const kind = tab === 'projects' ? 'project' : tab === 'blog' ? 'post' : tab === 'certificates' ? 'certificate' : null;
      const filtered = currentItems.filter(item => kind ? item.kind === kind : baseKinds.includes(item.kind) || item.kind === 'page');
      content.innerHTML = heading(kind === 'project' ? 'Projects with a story.' : kind === 'post' ? 'Your growing notebook.' : kind === 'certificate' ? 'Milestones worth sharing.' : 'Every word, in your hands.', 'Edit copy, links, images, visibility, and order. Public changes require a successful static rebuild and deployment.', `<button id="new-record" class="button button-primary">${icon('plus')}New ${kind ? labels[kind].toLowerCase() : 'page'}</button>`) + `<div class="content-list">${filtered.sort((a,b) => a.sort_order - b.sort_order).map(record => `<button class="content-row" data-edit="${esc(record.id)}"><div class="content-row-icon">${icon(record.kind === 'post' ? 'book' : record.kind === 'project' ? 'code' : record.kind === 'certificate' ? 'shield' : 'layers')}</div><div><strong>${esc(record.title)}</strong><small>${esc(labels[record.kind] || record.kind)}${record.slug ? ` / ${esc(record.slug)}` : ''}</small></div><span class="status-pill ${record.is_published ? 'published' : 'draft'}">${record.is_published ? 'Published' : 'Draft'}</span>${icon('chevron')}</button>`).join('')}</div>`;
      if (!kind) { const missing = defaultContent.filter(record => ['home','about','skills','contact'].includes(record.id) && !currentItems.some(item=>item.id===record.id)); if(missing.length) { const restore=document.createElement('div'); restore.className='restore-pages'; restore.innerHTML=missing.map(record=>`<button class="small-button" data-restore-page="${esc(record.id)}">${icon('plus')}Create ${esc(record.title)}</button>`).join(''); content.append(restore); restore.querySelectorAll('[data-restore-page]').forEach(button=>button.onclick=()=>editor({...structuredClone(defaultContent.find(record=>record.id===button.dataset.restorePage)),is_published:false})); } }
      content.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editor(structuredClone(currentItems.find(i => i.id === b.dataset.edit))));
      content.querySelector('#new-record').onclick = () => {
        const newKind = kind || 'page';
        const template = structuredClone(defaultContent.find(i => i.kind === newKind));
        template.id = `${newKind}:${uuid()}`; template.title = `Untitled ${labels[newKind].toLowerCase()}`; template.slug = `new-${uuid().slice(0, 8)}`; template.is_published = false; template.sort_order = 100;
        if (newKind === 'post') { template.slug=''; template.data={...structuredClone(ARTICLE_DEFAULTS),category:'',excerpt:'',body:'',imageUrl:'',sample:false}; }
        if (newKind === 'project') { template.data.body = ''; template.data.description = ''; template.data.url = ''; template.data.github = ''; template.data.featured = false; }
        if (newKind === 'page') { template.data.intro = ''; template.data.body = ''; }
        if (newKind === 'certificate') { template.data = {issuer:'',issuedDate:'',credentialId:'',credentialUrl:'',imageUrl:'',description:'',skills:[],sample:false}; }
        editor(template);
      };
    } else if (tab === 'media') await media(content);
    else if (tab === 'inbox' || tab === 'visits') await submissions(content, tab === 'inbox' ? 'contact' : 'visit');
    else if (tab === 'publishing') await publishing(content);
    else if (tab === 'security') security(content);
  }

  function editor(record) {
    if (!record) return;
    if(record.kind==='post') record.data={...structuredClone(ARTICLE_DEFAULTS),...record.data};
    const originalSlug=currentItems.find(item=>item.id===record.id)?.slug||record.slug;
    const isNew=!currentItems.some(item=>item.id===record.id);
    editing = record; const content = root.querySelector('#studio-content');
    const base = baseKinds.includes(record.kind);
    const protectedSettings = record.kind === 'settings';
    content.innerHTML = `<button class="back-link plain-button" id="close-editor">← Back to ${tab}</button>${heading(record.title, 'Content is escaped before rendering. Use the Media library for image and résumé URLs.')}<form id="record-form" class="record-form"><section class="editor-meta glass-panel"><label>Title<input name="title" value="${esc(record.title)}" required maxlength="180"></label>${!base ? `<label>URL slug<input name="slug" value="${esc(record.slug)}" pattern="[a-z0-9]+(-[a-z0-9]+)*" required maxlength="100"></label>` : ''}<label>Display order<input name="sort_order" type="number" value="${record.sort_order}" min="0" max="99999"></label>${!protectedSettings ? `<label class="cms-check"><input name="is_published" type="checkbox" ${record.is_published ? 'checked' : ''}><span>Published</span></label>` : ''}</section><section class="editor-fields glass-panel">${fields(record.data)}</section>${record.kind==='post'?seoPanel(record,import.meta.env.VITE_SITE_URL||location.origin):''}<div class="editor-savebar"><span id="save-status">${configured ? 'Public changes are queued for rebuilding after saving.' : 'Changes stay in this browser.'}</span>${!protectedSettings ? `<button class="small-button danger" type="button" id="delete-record">${icon('trash')}Delete</button>` : ''}<button type="submit" class="button button-primary">Save changes ${icon('check')}</button></div><p class="form-error" id="record-error" role="alert"></p></form>`;
    const form = content.querySelector('#record-form');
    function readForm() {
      record.title = form.elements.title.value.trim();
      if (form.elements.slug) record.slug = slugify(form.elements.slug.value,100);
      record.sort_order = Math.max(0, Math.min(99999, Number(form.elements.sort_order.value) || 0));
      if (form.elements.is_published) record.is_published = form.elements.is_published.checked;
      form.querySelectorAll('[name^="data."]').forEach(input => { const type = input.dataset.valueType; putPath(record, input.name, type === 'boolean' ? input.checked : type === 'number' ? Number(input.value) : input.value); });
    }
    if(record.kind==='post') {
      let manualSlug=Boolean(record.slug);
      form.elements.slug.addEventListener('input',()=>{manualSlug=true;});
      form.addEventListener('input',event=>{ if(isNew&&!manualSlug&&event.target===form.elements.title)form.elements.slug.value=slugify(form.elements.title.value); updateSeoPreview(form,record,import.meta.env.VITE_SITE_URL||location.origin,originalSlug); });
      updateSeoPreview(form,record,import.meta.env.VITE_SITE_URL||location.origin,originalSlug);
      form.querySelector('[data-preview-article]').onclick=()=>{readForm();const target=form.querySelector('[data-article-editor-preview]');target.hidden=!target.hidden;if(!target.hidden)target.innerHTML=articleView(record,currentItems,{...seoSettings.data,...getData(currentItems,'seo-settings')}).html;};
    }
    content.querySelector('#close-editor').onclick = () => { editing = null; renderTab(); };
    form.querySelectorAll('[data-add-array]').forEach(button => button.onclick = () => {
      readForm(); const path = button.dataset.addArray; const array = atPath(record, path); const sample = array[0];
      array.push(arrayDefaults[path.split('.').at(-1)] ? structuredClone(arrayDefaults[path.split('.').at(-1)]) : sample && typeof sample === 'object' ? Object.fromEntries(Object.entries(sample).map(([key,value])=>[key,Array.isArray(value)?[]:typeof value==='boolean'?false:typeof value==='number'?0:''])) : 'New item'); editor(record);
    });
    form.querySelectorAll('[data-move-array]').forEach(button => button.onclick = () => { readForm(); const array=atPath(record,button.dataset.moveArray); const from=Number(button.dataset.index), to=from+Number(button.dataset.direction); if(to>=0&&to<array.length) [array[from],array[to]]=[array[to],array[from]]; editor(record); });
    form.querySelectorAll('[data-upload-asset]').forEach(button => button.onclick = () => form.querySelector(`[data-asset-file="${CSS.escape(button.dataset.uploadAsset)}"]`).click());
    form.querySelectorAll('[data-remove-asset]').forEach(button => button.onclick = () => { readForm(); putPath(record,button.dataset.removeAsset,''); editor(record); });
    form.querySelectorAll('[data-asset-file]').forEach(input => input.onchange = async () => {
      const file=input.files[0]; if(!file) return; const button=form.querySelector(`[data-upload-asset="${CSS.escape(input.dataset.assetFile)}"]`); button.disabled=true;
      try { const isResume=input.dataset.assetFile.endsWith('.resumeUrl'); const uploaded=await uploadMedia(file,{imageOnly:!isResume,pdfOnly:isResume}); readForm(); putPath(record,input.dataset.assetFile,uploaded.url); if(record.kind==='post'&&file.type.startsWith('image/')) { const bitmap=await createImageBitmap(file); const social=input.dataset.assetFile.endsWith('.socialImageUrl'); record.data[social?'socialImageWidth':'imageWidth']=bitmap.width; record.data[social?'socialImageHeight':'imageHeight']=bitmap.height; bitmap.close(); } editor(record); toast(configured?'File uploaded. Save this content to publish the change.':'File saved in this browser. Save your content next.'); } catch(error) { content.querySelector('#record-error').textContent=error.message; button.disabled=false; }
    });
    form.querySelectorAll('[data-remove-array]').forEach(button => button.onclick = () => { readForm(); atPath(record, button.dataset.removeArray).splice(Number(button.dataset.index), 1); editor(record); });
    form.onsubmit = async event => {
      event.preventDefault(); readForm(); const button = form.querySelector('[type="submit"]'); button.disabled = true;
      try {
        if (!record.title) throw new Error('A title is required.');
        const issues=publishingIssues(record);if(issues.length)throw new Error(issues.join(' '));
        if (currentItems.some(item => item.id !== record.id && item.kind === record.kind && item.slug && item.slug === record.slug)) throw new Error('This URL slug is already used. Choose a different one.');
        if (protectedSettings) record.is_published = true;
        if (record.kind === 'certificate' && record.is_published && !record.data.sample && !mediaUrl(record.data.imageUrl)) throw new Error('Upload a certificate image before publishing it. You can save it as a draft first.');
        if (record.kind === 'page' && ['admin','about','blog','projects','certificates','contact','lab'].includes(record.slug)) throw new Error('That URL belongs to a built-in page. Choose another slug.');
        if (record.id === 'layout' && new Set(record.data.homeSections.map(row=>row.section)).size !== record.data.homeSections.length) throw new Error('Each homepage section can appear once. Remove duplicate section rows.');
        currentItems = await saveContent(record, currentItems); ctx.update(currentItems); editing = null; toast(publishingNotice || 'Saved.'); renderTab();
      } catch (error) { content.querySelector('#record-error').textContent = error.message; button.disabled = false; }
    };
    content.querySelector('#delete-record')?.addEventListener('click', async () => {
      if (!window.confirm(`Delete “${record.title}”? This removes it from the site.`)) return;
      try { currentItems = await removeContent(record.id, currentItems); ctx.update(currentItems); editing = null; toast(publishingNotice || 'Content removed.'); renderTab(); } catch (error) { toast(error.message, true); }
    });
  }

  async function media(content) {
    content.innerHTML = heading('Your visual toolkit.', 'Upload certificate images, a portrait, project previews, article covers, or your résumé. You can also upload directly inside each content editor.') + `<form class="media-upload glass-panel" id="media-form"><label class="attachment-zone">${icon('upload')}<span><strong>Choose an image or résumé</strong><small>JPG, PNG, WebP, or PDF · up to 5 MB · ${configured ? 'public portfolio assets' : 'saved only in this browser'}</small></span><input type="file" name="file" accept=".jpg,.jpeg,.png,.webp,.pdf" required></label><button class="button button-primary" type="submit">Upload to media ${icon('upload')}</button><p class="form-error" id="media-error" role="alert"></p></form><div id="media-results" class="media-grid"><p>Loading your files…</p></div>`;
    content.querySelector('#media-form').onsubmit = async event => {
      event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
      try { await uploadMedia(event.currentTarget.file.files[0]); toast(configured ? 'File uploaded.' : 'File saved in this browser.'); await media(content); } catch (error) { content.querySelector('#media-error').textContent = error.message; button.disabled = false; }
    };
    let files;
    try { files = await listMedia(); } catch { content.querySelector('#media-results').textContent='Could not load your media. Check your connection or browser storage.'; return; }
    if (!content.isConnected) return;
    content.querySelector('#media-results').innerHTML = files.length ? files.map(file => {
      const url = mediaUrl(file.url);
      return `<article class="media-card">${/\.(jpg|jpeg|png|webp)$/i.test(file.name) ? `<img src="${esc(url)}" alt="Uploaded portfolio asset" loading="lazy">` : `<div class="media-pdf">${icon('file')}PDF</div>`}<strong>${esc(file.name)}</strong><div><button class="small-button" data-copy="${esc(file.url)}">Copy reference</button><button class="icon-button danger" data-delete-file="${esc(file.path)}" aria-label="Delete file">${icon('trash')}</button></div></article>`;
    }).join('') : '<p class="empty-state">A clean slate. Upload your first asset above.</p>';
    content.querySelectorAll('[data-copy]').forEach(button => button.onclick = async () => { try { await navigator.clipboard.writeText(button.dataset.copy); toast('Reference copied. Paste it into any image or résumé field.'); } catch { const reference=document.createElement('input'); reference.value=button.dataset.copy; reference.readOnly=true; button.closest('.media-card').append(reference); reference.select(); toast('Copy the reference shown below the file.'); } });
    content.querySelectorAll('[data-delete-file]').forEach(button => button.onclick = async () => {
      const file=files.find(item=>item.path===button.dataset.deleteFile);
      if (JSON.stringify(currentItems).includes(file.url)) return toast('This file is used by content. Replace or remove those image references first.',true);
      if (!confirm('Delete this unused asset?')) return;
      try { await deleteMedia(file.path); toast('Unused file removed.'); media(content); } catch(error) { toast(error.message,true); }
    });
  }

  async function submissions(content, kind) {
    content.innerHTML = heading(kind === 'contact' ? 'Conversations start here.' : 'Your project’s demo records.', kind === 'contact' ? 'Contact messages and private attachments. Never shown to visitors.' : 'Consented submissions. Deleting a record also deletes its stored file; emailed copies require separate deletion.') + '<div id="submission-results" class="submission-list"></div>';
    const results = content.querySelector('#submission-results');
    if (!configured) { results.innerHTML = `<div class="empty-state">${icon(kind === 'contact' ? 'mail' : 'camera')}<h2>No ${kind === 'contact' ? 'messages' : 'demo records'} in this preview.</h2><p>Connect Supabase to receive and privately manage real submissions.</p></div>`; return; }
    const { data, error } = await supabase.from('submissions').select('*').eq('kind', kind).order('created_at', { ascending: false }).limit(100);
    if (!content.isConnected) return;
    if (error) { results.textContent = 'Records are locked. Verify your second factor and try again.'; return; }
    results.innerHTML = data.length ? data.map(row => `<article class="submission-card"><div class="submission-top"><div><strong>${kind === 'contact' ? esc(row.name) : 'Camera & location submission'}</strong><small>${esc(new Date(row.created_at).toLocaleString())} · ${esc(row.email_status)}</small></div><button class="icon-button danger" data-delete-submission="${esc(row.id)}" aria-label="Delete submission">${icon('trash')}</button></div>${kind === 'contact' ? `<a href="mailto:${esc(row.email)}">${esc(row.email)}</a><h3>${esc(row.subject)}</h3><p>${esc(row.message).replaceAll('\n', '<br>')}</p>` : `<p>Latitude: ${esc(row.latitude)} · Longitude: ${esc(row.longitude)}<br>Accuracy: ±${esc(row.accuracy)} m</p><small>Consent: ${esc(row.consent_version)} · ${esc(row.consent_at)}</small>`}${row.file_path ? `<button class="small-button" data-view-private="${esc(row.file_path)}">${icon('eye')}Open private ${kind === 'contact' ? 'attachment' : 'photo'} (60 sec)</button>` : ''}<code>Reference: ${esc(row.id)}</code></article>`).join('') : '<div class="empty-state">Nothing here yet.</div>';
    results.querySelectorAll('[data-view-private]').forEach(b => b.onclick = async () => {
      const { data: signed, error } = await supabase.storage.from('portfolio-private').createSignedUrl(b.dataset.viewPrivate, 60);
      if (error) return toast('This file could not be opened. Check your session.', true);
      const link = document.createElement('a'); link.href = signed.signedUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
    });
    results.querySelectorAll('[data-delete-submission]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this database record and its stored file? Emailed copies must be deleted separately.')) return;
      const row = data.find(item => item.id === b.dataset.deleteSubmission);
      if (row.file_path) { const { error } = await supabase.storage.from('portfolio-private').remove([row.file_path]); if (error) return toast('Could not delete the file. The record was kept.', true); }
      const { error } = await supabase.from('submissions').delete().eq('id', row.id); if (error) toast('The record could not be deleted. Retry to complete cleanup.', true); else { toast('Record and file removed.'); submissions(content, kind); }
    });
  }

  async function publishing(content) {
    content.innerHTML=heading('From a draft to a public page.','Saving public content queues a static rebuild. A requested build is not confirmation that deployment succeeded.')+`<section class="glass-panel publishing-panel"><h2>Publishing status</h2><p id="publishing-message">${configured?'Checking the queue…':'Local preview: nothing is deployed. Use npm run dev:spa for local editing, then rebuild a snapshot or connect Supabase.'}</p><button class="button button-primary" id="retry-publishing" ${configured?'':'disabled'}>Request / retry build ${icon('upload')}</button><button class="button button-outline" id="export-public">Export public content JSON</button><p class="muted">Drafts are excluded from the export. Browser-only image references must be replaced with publishable image URLs before building.</p><p class="muted">Publication dates are generated on first publication. Content modification dates change when visible article content changes. Slug changes generate redirects; deleting a previously published article generates a 410 response after rebuilding.</p></section>`;
    content.querySelector('#retry-publishing').onclick=async()=>{await requestPublishing();content.querySelector('#publishing-message').textContent=publishingNotice;};
    content.querySelector('#export-public').onclick=()=>{const publicItems=currentItems.filter(item=>item.is_published&&!(item.kind==='post'&&item.data.sample));const routes=JSON.parse(localStorage.getItem('nabin-portfolio-local-routes-v1')||'[]').map(({source_path,target_path,status})=>({source_path,target_path,status}));const blob=new Blob([JSON.stringify({items:publicItems,redirects:routes},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='portfolio-public-content.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    if(configured){const {data,error}=await supabase.from('publishing_status').select('*').eq('id',1).single();if(!content.isConnected)return;content.querySelector('#publishing-message').textContent=error?'Publishing setup is incomplete. Apply the SEO migration and configure the server-side deploy hook.':`State: ${data.state}. Pending changes: ${data.pending_count}. Last build request: ${data.last_requested_at||'none'}.${data.last_error?' '+data.last_error:''}`;}
  }

  function security(content) {
    content.innerHTML = heading('Two keys. One private studio.', 'Authentication is enforced by Supabase policies, not just this interface.') + `<div class="security-grid"><article class="glass-panel security-card">${icon('shield')}<h2>Password + TOTP</h2><p>${configured ? 'This session has passed password sign-in and a verified authenticator challenge.' : 'Enable Supabase to use real password sign-in and authenticator enrollment. This local preview has no authentication.'}</p><span class="status-pill ${configured ? 'published' : 'draft'}">${configured ? 'AAL2 verified' : 'Setup required'}</span></article><article class="glass-panel security-card">${icon('lock')}<h2>Database & file policies</h2><p>Only allowlisted administrators with AAL2 can edit content, manage media, or access private records. Public users can read published content only.</p></article><article class="glass-panel security-card">${icon('clock')}<h2>Session protection</h2><p>Sessions are kept in this tab’s session storage. Studio locks after 15 minutes of inactivity. Sign out on shared devices.</p></article><article class="glass-panel security-card">${icon('file')}<h2>Audit trail</h2><p>Content changes and submission deletions are recorded by database triggers. No passwords, MFA secrets, photos, or message bodies are copied into audit events.</p></article></div><div class="security-note"><h3>Account recovery</h3><p>If you lose your authenticator, use the Supabase dashboard’s administrator account recovery tools. There is no public reset or MFA bypass in this portfolio.</p></div>${configured ? '<button class="button button-outline" id="security-signout">Sign out of this session</button>' : '<button class="button button-outline" id="reset-preview">Reset local preview content</button>'}<div class="audit-log" id="audit-log"></div>`;
    content.querySelector('#security-signout')?.addEventListener('click', async () => { await supabase.auth.signOut({ scope: 'local' }); login(); });
    content.querySelector('#reset-preview')?.addEventListener('click', () => { if (!confirm('Reset local preview content to the starting content? Uploaded files remain in your local Media library.')) return; localStorage.removeItem('nabin-portfolio-preview-v1'); currentItems = structuredClone(defaultContent); ctx.update(currentItems); shell(); toast('Local preview reset.'); });
    if (configured) supabase.from('audit_events').select('*').order('created_at', { ascending: false }).limit(30).then(({ data, error }) => { const target = content.querySelector('#audit-log'); if (!target?.isConnected) return; target.innerHTML = '<h3>Recent audit events</h3>' + (error ? '<p>Could not load audit events.</p>' : data.map(event => `<div><span>${esc(event.action)} · ${esc(event.record_id)}</span><small>${esc(new Date(event.created_at).toLocaleString())}</small></div>`).join('') || '<p>No events yet.</p>'); });
  }

  document.addEventListener('pointerdown', activity); document.addEventListener('keydown', activity);
  if (configured) {
    const { data } = supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT' && !disposed) { currentItems = structuredClone(defaultContent); ctx.update(currentItems); login(); } }); authUnsubscribe = () => data.subscription.unsubscribe();
    if (await isAdminSession()) { currentItems = await loadContent(true); ctx.update(currentItems); shell(); }
    else { const { data: { session } } = await supabase.auth.getSession(); if (session) await mfa(); else login(); }
  } else login();
  return cleanup;
}
