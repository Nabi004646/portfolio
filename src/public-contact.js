import {configured,submitPublic,mountTurnstile} from './api.js';
import {uuid,esc,icon} from './utils.js';

export async function bindPublicContact(){
  const form=document.getElementById('contact-form');if(!form)return;
  form.onsubmit=event=>event.preventDefault();const error=document.getElementById('contact-error');let captcha;
  try{captcha=await mountTurnstile(document.getElementById('contact-turnstile'));}catch{error.textContent='The bot check could not load. Please reload to retry.';}
  let reference=uuid();form.addEventListener('input',()=>{reference=uuid();});
  const fileInput=form.elements.attachment;
  fileInput.onchange=()=>{const file=fileInput.files[0];if(file&&(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>5242880)){fileInput.value='';error.textContent='Choose a JPG, PNG, WebP, or PDF under 5 MB.';}const selected=fileInput.files[0];document.getElementById('attachment-name').textContent=selected?`${selected.name} · ${Math.ceil(selected.size/1024)} KB`:'Add a brief or reference';form.querySelector('.attachment-remove').hidden=!selected;};
  form.querySelector('.attachment-remove').onclick=()=>{fileInput.value='';fileInput.dispatchEvent(new Event('change'));};
  form.onsubmit=async event=>{event.preventDefault();error.textContent='';const button=form.querySelector('[type="submit"]');const previous=button.innerHTML;
    if(!configured){error.textContent='Message delivery is unavailable right now. Please contact me by email instead. Your message has not been sent.';return;}
    button.disabled=true;button.textContent='Sending your note…';
    try{const data=new FormData(form);data.set('requestId',reference);data.set('consent',String(form.elements.consent.checked));data.set('turnstileToken',captcha?.token()||'');const result=await submitPublic('submit-contact',data);form.innerHTML=`<div class="form-success"><div>${icon('check')}</div><h2>Your note is in.</h2><p>Thanks for reaching out.</p><small>Reference: ${esc(result.id)}</small><a href="/projects/" class="text-link">Explore the work →</a></div>`;captcha?.destroy();}catch(e){error.textContent=e.message;button.disabled=false;button.innerHTML=previous;captcha?.reset();}
  };
}
