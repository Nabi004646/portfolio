import { uuid } from './utils.js';
import {createBotToken} from './bot-token.js';
import { createClient } from '@supabase/supabase-js';
import { defaultContent } from './content.js';
import { extendedContent, mergeEditorFields } from './extended-content.js';
import { hydrateLocalMedia, putLocalMedia, listLocalMedia, deleteLocalMedia } from './local-media.js';
import { validateFile } from '../supabase/functions/_shared/validation.ts';
import {ARTICLE_DEFAULTS,seoSettings} from './seo/model.js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && /^sb_publishable_[a-z0-9_-]{20,}$/i.test(key) && !/YOUR_/i.test(key);
export const supabase = configured ? createClient(url, key, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
const localKey = 'nabin-portfolio-preview-v1';
export let contentSource = configured ? 'live' : 'preview';
export let publishingNotice = '';
const localRoutesKey='nabin-portfolio-local-routes-v1';
function editorFields(records){return mergeEditorFields(records,defaultContent).map(record=>record.kind==='post'?{...record,data:{...structuredClone(ARTICLE_DEFAULTS),...record.data}}:record);}

export async function loadContent(admin = false) {
  if (!configured) {
    await hydrateLocalMedia().catch(() => {});
    try {
      let stored = JSON.parse(localStorage.getItem(localKey));
      if (Array.isArray(stored) && stored.length) {
        if (localStorage.getItem(`${localKey}-schema`) !== '4') {
          stored = stored.map(record=>{if(record.id==='settings'){record.data.facebook='https://www.facebook.com/nabie.webdev';record.data.github='https://github.com/Nabi004646';record.data.personalLinks=record.data.personalLinks||structuredClone(defaultContent.find(item=>item.id==='settings').data.personalLinks);const links=record.data.socialLinks||[];if(!links.some(link=>link.url===record.data.facebook))links.unshift({label:'Facebook',icon:'facebook',url:record.data.facebook});if(!links.some(link=>link.url===record.data.github))links.push({label:'GitHub',icon:'github',url:record.data.github});record.data.socialLinks=links;}return record;});
          stored = stored.map(record=>record.kind==='post'&&record.data.sample?{...record,is_published:false}:record);
          stored = [...stored, ...extendedContent.filter(record => !stored.some(item => item.id === record.id)).map(record => structuredClone(record))];
          localStorage.setItem(`${localKey}-schema`, '4'); localStorage.setItem(localKey, JSON.stringify(stored));
        }
        if(!stored.some(item=>item.id==='seo-settings'))stored.push(structuredClone(seoSettings));
        return editorFields(stored);
      }
    } catch { /* Start from the initial copy. */ }
    localStorage.setItem(`${localKey}-schema`, '4');
    return structuredClone(defaultContent);
  }
  let query = supabase.from('content_items').select('*').order('sort_order');
  if (!admin) query = query.eq('is_published', true);
  const { data, error } = await query;
  if (error) { contentSource = 'offline'; throw new Error('Content is temporarily unavailable. Please try again.'); }
  contentSource = 'live';
  if(admin&&!data.some(item=>item.id==='seo-settings'))data.push(structuredClone(seoSettings));
  return editorFields(data);
}

export async function configurePublishing(deployHook){
  if(!configured)throw new Error('Connect Supabase before setting up publishing.');
  const {error}=await supabase.rpc('configure_portfolio_publishing',{p_deploy_hook:deployHook.trim(),p_function_url:`${url.replace(/\/$/,'')}/functions/v1/request-publish`});
  if(error?.code==='PGRST202')throw new Error('The publishing-connection migration still needs installation. As an alternative, set CLOUDFLARE_DEPLOY_HOOK privately in Supabase Edge Function Secrets, then request a build here.');
  if(error)throw new Error('Publishing could not be connected. Verify your second factor and use the Cloudflare Pages production deploy hook URL.');
}
export async function requestPublishing(){
  if(!configured){publishingNotice='Saved in this browser. Export public content from Studio and rebuild to preview generated HTML; nothing was deployed.';return;}
  const {publishingFeedback}=await import('./publishing-feedback.js');
  try{
    const {data,error}=await supabase.functions.invoke('request-publish',{body:{action:'dispatch'}});
    let detail=data;
    if(error?.context instanceof Response)detail=await error.context.clone().json().catch(()=>null);
    publishingNotice=publishingFeedback(detail,{status:error?.context?.status||0,failed:Boolean(error)});
  }catch{publishingNotice=publishingFeedback(null,{failed:true});}
}

export async function saveContent(record, items) {
  if (!configured) {
    const old=items.find(item=>item.id===record.id);const now=new Date().toISOString();
    if(record.kind==='post'){
      record.first_published_at=old?.first_published_at||(record.is_published?now:null);
      const material=!old||old.title!==record.title||['body','excerpt','imageUrl','imageAlt','sources','relatedProjectSlugs'].some(key=>JSON.stringify(old.data[key])!==JSON.stringify(record.data[key]));
      record.content_modified_at=record.first_published_at?(material?now:old?.content_modified_at||record.first_published_at):null;
      if(old?.first_published_at&&old.slug!==record.slug){const routes=JSON.parse(localStorage.getItem(localRoutesKey)||'[]').filter(row=>row.source_path!==`/blog/${record.slug}/`);routes.forEach(row=>{if(row.record_id===record.id){row.target_path=`/blog/${record.slug}/`;row.status=301;}});routes.push({source_path:`/blog/${old.slug}/`,target_path:`/blog/${record.slug}/`,status:301,record_id:record.id});localStorage.setItem(localRoutesKey,JSON.stringify(routes));}
    }
    const next = items.filter(item => item.id !== record.id).concat(record);
    localStorage.setItem(localKey, JSON.stringify(next));publishingNotice='Saved in this browser. No deployment was requested.';return next;
  }
  const { error } = await supabase.from('content_items').upsert({
    id: record.id, kind: record.kind, title: record.title, slug: record.slug,
    is_published: record.is_published, sort_order: record.sort_order, data: record.data,
  });
  if (error) throw error;
  await requestPublishing();
  return loadContent(true);
}

export async function removeContent(id, items) {
  if (!configured) { const record=items.find(item=>item.id===id);if(record?.kind==='post'&&record.first_published_at){const routes=JSON.parse(localStorage.getItem(localRoutesKey)||'[]');routes.forEach(row=>{if(row.record_id===id){row.status=410;row.target_path=null;}});routes.push({source_path:`/blog/${record.slug}/`,target_path:null,status:410,record_id:id});localStorage.setItem(localRoutesKey,JSON.stringify(routes));}const next = items.filter(item => item.id !== id); localStorage.setItem(localKey, JSON.stringify(next));publishingNotice='Removed from this browser’s preview.';return next; }
  const { error } = await supabase.from('content_items').delete().eq('id', id); if (error) throw error; await requestPublishing(); return loadContent(true);
}

export async function submitPublic(functionName, formData) {
  if (!configured) throw new Error('Supabase is not connected. This preview does not send messages or visitor data.');
  const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/${functionName}`, {
    method: 'POST', headers: { apikey: key }, body: formData, signal: AbortSignal.timeout(45000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || 'Submission failed. Please try again.');
  return result;
}

export async function uploadMedia(file, { imageOnly = false, pdfOnly = false } = {}) {
  if (!file) throw new Error('Choose a file first.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG, WebP, or PDF under 5 MB.');
  if (imageOnly && !file.type.startsWith('image/')) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (pdfOnly && file.type !== 'application/pdf') throw new Error('Choose a PDF résumé.');
  await validateFile(file, true);
  if (!configured) return putLocalMedia(file);
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[file.type];
  const path = `${uuid()}.${ext}`;
  const { error } = await supabase.storage.from('portfolio-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, url: supabase.storage.from('portfolio-media').getPublicUrl(path).data.publicUrl };
}

export async function listMedia() {
  if (!configured) return listLocalMedia();
  const { data, error } = await supabase.storage.from('portfolio-media').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw error;
  return data.map(file => ({name:file.name,path:file.name,size:file.metadata?.size||0,url:supabase.storage.from('portfolio-media').getPublicUrl(file.name).data.publicUrl}));
}
export async function deleteMedia(path) {
  if (!configured) return deleteLocalMedia(path);
  const { error } = await supabase.storage.from('portfolio-media').remove([path]); if (error) throw error;
}

export async function isAdminSession() {
  if (!configured) return false;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  const { data } = await supabase.from('admin_members').select('user_id').eq('user_id', user.id).maybeSingle();
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return Boolean(data && assurance?.currentLevel === 'aal2');
}

let turnstileLoader;
export async function mountTurnstile(container,{onChange=()=>{},onError}={}) {
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!sitekey) return { token: () => '', expiresAt:()=>0, reset: () => {}, destroy: () => {} };
  turnstileLoader ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
    script.onload = resolve; script.onerror = () => reject(new Error('Bot check could not load. Please retry.')); document.head.append(script);
  });
  try{await turnstileLoader;}catch(error){turnstileLoader=undefined;throw error;}
  if(!container?.isConnected)throw new Error('Bot check was closed.');
  const state=createBotToken();let destroyed=false;
  const change=value=>{if(destroyed)return;state.set(value);onChange(state.token());};
  const id = window.turnstile.render(container, { sitekey, theme: 'auto',retry:onError?'never':'auto', callback: change, 'expired-callback': () => change(''), 'error-callback': code => {change('');onError?.(code);return Boolean(onError);} });
  return { token:state.token,expiresAt:state.expiresAt,reset:()=>{state.clear();onChange('');window.turnstile.reset(id);},destroy:()=>{if(destroyed)return;destroyed=true;state.clear();window.turnstile.remove(id);} };
}
