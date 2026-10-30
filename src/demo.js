import { configured, mountTurnstile, submitPublic } from './api.js';
import { uuid, esc, icon } from './utils.js';
import { CONSENT_VERSION } from '../supabase/functions/_shared/validation.ts';
import {usableBotToken} from './bot-token.js';

export { CONSENT_VERSION };
let activeClose;

export function openConsentDemo({ settings, required, onDone, onCancel }) {
  activeClose?.();
  const root = document.getElementById('modal-root');
  const previousFocus = document.activeElement;
  let closed = false, stream, detector, timer, captcha, payload, attempt, previewUrl, setupWatchdog, acceptedResult, completionTimer;
  const disclosure = `${required?'Homepage entry requires this submission. If you do not agree, leave this page. ':''}Continuing will use your camera to automatically capture one full-frame photo after a visible countdown and request your location. The photo and coordinates will be sent to ${settings.demoRecipientLabel || settings.name} by email${settings.email ? ` (${settings.email})` : ''}. This is an educational demo, not human or identity verification.`;
  const localDisclosure = 'This device-only test requests camera and location permission, detects one face locally, then captures one full-frame photo after a visible countdown. The photo and coordinates are shown only in this open dialog. They are not uploaded or emailed. Close the test to discard them. This is not identity verification.';

  function stopCamera(cancel = true) {
    if (attempt && cancel) attempt.cancelled = true;
    clearTimeout(setupWatchdog);setupWatchdog=undefined;
    clearInterval(timer); timer = undefined;
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
    detector?.close(); detector = undefined;
  }
  function close(done = false) {
    if (closed) return;
    closed = true; clearTimeout(completionTimer); stopCamera(); captcha?.destroy();
    document.removeEventListener('keydown', keyboard);
    document.removeEventListener('portfolio:navigate', navigate);
    root.innerHTML = ''; document.body.classList.remove('modal-open'); payload = undefined;
    if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=undefined;
    document.getElementById('app').inert = false;
    previousFocus?.focus?.(); activeClose = undefined;
    if (done) onDone?.(acceptedResult); else onCancel?.();
  }
  activeClose = () => close();
  const navigate = () => close();
  document.addEventListener('portfolio:navigate', navigate);
  function keyboard(event) {
    if (event.key === 'Escape') { if (!root.querySelector('[data-sending]')) close(); return; }
    if (event.key !== 'Tab') return;
    const elements = [...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(e => !e.hidden);
    if (!elements.length) { event.preventDefault(); return; }
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', keyboard);
  document.body.classList.add('modal-open');
  document.getElementById('app').inert = true;

  function layout(body, subtitle = required ? 'WELCOME / ENTRY CONSENT' : 'A small browser experiment.') {
    root.innerHTML = `<div class="modal-backdrop"><section class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title"><div class="modal-top"><span class="modal-brand">${icon('spark')} ${esc(settings.brand||'Nabin')} / ${required?'Welcome':'Lab'}</span><button class="icon-button modal-close" aria-label="${required?'Cancel entry':'Cancel demo'}">${icon('close')}</button></div><div class="modal-icon">${icon('camera')}</div><span class="small-label">${esc(subtitle)}</span><h2 id="demo-title">A moment before<br>we begin.</h2>${body}<div class="modal-bottom">${icon('lock')} Camera + location · disclosed before capture</div></section></div>`;
    root.querySelector('.modal-close').onclick = () => close();
  }

  async function initial() {
    if(required&&!configured){
      layout('<p class="form-error" role="alert">The submission service is not connected. No camera or location access has been requested.</p><button class="button button-outline" id="unavailable-close">Close</button>','ENTRY UNAVAILABLE');
      root.querySelector('#unavailable-close').onclick=()=>close();return;
    }
    layout(`<p class="consent-disclosure">${esc(configured?disclosure:localDisclosure)}</p><div class="consent-features"><span>${icon('camera')}One photo</span><span>${icon('pin')}Your location</span><span>${icon('mail')}${configured?'Email to owner':'No upload or email'}</span></div>${!configured ? '<p class="local-warning">Email delivery is not connected. You can test your own device locally, or choose the simulated walkthrough without granting permissions.</p>' : '<p class="consent-note">You can cancel before capture. Camera access stops after the photo. The record remains private to the owner.</p>'}<div id="demo-turnstile"></div><p class="form-error" id="demo-error" role="alert"></p>${configured?`<button class="button button-primary" id="consent-start">${required?'Agree &amp; Start':'Continue and capture'} ${icon('arrow')}</button>${required?'':'<button class="button button-outline" id="device-test">Test camera & location without sending</button>'}`:'<button class="button button-primary" id="device-test">Test camera & location locally</button><button class="button button-outline" id="preview-walkthrough">Explore the simulated walkthrough →</button>'}<div class="consent-links"><a href="/privacy" id="demo-privacy">Read privacy details</a><button class="plain-button" id="demo-cancel">${required ? 'Cancel entry' : 'Cancel'}</button></div>`);
    root.querySelector('#demo-cancel').onclick = () => close();
    root.querySelector('#demo-privacy').onclick = event => { event.preventDefault(); close(); location.assign('/privacy/'); };
    root.querySelector('#preview-walkthrough')?.addEventListener('click', walkthrough);
    root.querySelector('#consent-start')?.addEventListener('click',()=>start(false));
    root.querySelector('#device-test')?.addEventListener('click',()=>start(true));
    root.querySelector(!configured ? '#preview-walkthrough' : '#consent-start').focus();
    if (configured) {
      try { captcha = await mountTurnstile(root.querySelector('#demo-turnstile')); if (closed) captcha?.destroy(); }
      catch (error) { if (!closed) root.querySelector('#demo-error').textContent = error.message; }
    }
  }

  async function walkthrough() {
    captcha?.destroy(); captcha = undefined;
    layout(`<div class="walkthrough-frame"><div class="walkthrough-person">${icon('camera')}</div><span class="walkthrough-badge">Simulated preview · no data collected</span><div class="countdown" id="countdown">3</div></div><p class="demo-status" role="status" id="demo-status">A visible countdown before automatic capture.</p>`, 'LOCAL WALKTHROUGH');
    let seconds = 3;
    timer = setInterval(() => {
      if (closed) return;
      seconds--;
      if (seconds > 0) root.querySelector('#countdown').textContent = seconds;
      else {
        clearInterval(timer);
        layout(`<div class="demo-complete">${icon('check')}</div><p class="consent-disclosure">The connected flow captures a photo after consent and emails it with location data. The portfolio remains accessible independently of this optional Lab.</p><p class="local-warning">This walkthrough did not use your camera or location, and did not send an email.</p><button class="button button-primary" id="walkthrough-done">Close walkthrough ${icon('check')}</button>`, 'PREVIEW COMPLETE');
        root.querySelector('#walkthrough-done').onclick = () => close(true);
        root.querySelector('#walkthrough-done').focus();
      }
    }, 1000);
  }

  async function start(localOnly = false) {
    const captureAttempt = { cancelled: false };
    attempt = captureAttempt;
    const token = captcha?.token() || '';
    if (!localOnly && import.meta.env.VITE_TURNSTILE_SITE_KEY && !token) {
      root.querySelector('#demo-error').textContent = required?'Wait for the bot check to finish, then choose Agree & Start. No camera or location access has started.':'Wait for the bot check to finish before capturing. You can also test your camera and location without sending anything.';
      return;
    }
    const button = root.querySelector(localOnly?'#device-test':'#consent-start'); button.disabled = true;
    try {
      if (localOnly) {
        layout(`<p class="consent-disclosure">${esc(localDisclosure)}</p><button class="button button-primary" id="confirm-device-test">Start device-only test ${icon('camera')}</button><button class="button button-outline" id="cancel-device-test">Cancel</button>`, 'NO UPLOAD OR EMAIL');
        root.querySelector('#confirm-device-test').onclick = () => capture(true);
        root.querySelector('#cancel-device-test').onclick = () => close();
        return;
      }
      await capture(false);
    } catch (error) { stopCamera(); failure(error.message || 'The demo could not start.'); }
  }

  async function capture(localOnly) {
    if (closed) return;
    const captureAttempt = attempt;
    if (captureAttempt.started || captureAttempt.cancelled) return;
    captureAttempt.started = true;
    const token = captcha?.token() || '';
    const tokenExpiresAt=captcha?.expiresAt()||0;
    const consentAt = new Date().toISOString();
    setupWatchdog=setTimeout(()=>{if(!closed&&attempt===captureAttempt&&!captureAttempt.cancelled){stopCamera();failure('No capture was made. Camera setup timed out and your camera is off. You can try again.');}},90000);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !navigator.geolocation) throw new Error('This demo needs HTTPS or localhost, a camera, and location support.');
      // Both APIs are called only from this explicit consent action.
      const cameraPromise = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } }, audio: false }).then(value => { if (closed || captureAttempt.cancelled) { value.getTracks().forEach(t => t.stop()); throw new Error('Cancelled'); } stream = value; return value; });
      const locationPromise = new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 45000 }));
      layout(`<div class="camera-frame"><video id="demo-video" autoplay muted playsinline></video><div class="face-guide"></div><span class="camera-live"><i></i>Camera preview</span><div class="countdown" id="countdown" hidden></div></div><p class="demo-status" id="demo-status" role="status">Allow camera and location. Loading face detection…</p><p class="consent-note">The full frame will be captured automatically after your face is visible and the countdown finishes. Cancel any time before capture.</p>`, 'CAPTURE AFTER CONSENT');
      const video = root.querySelector('#demo-video');
      const [camera, position] = await Promise.all([cameraPromise.then(async camera=>{if(!closed&&!captureAttempt.cancelled){video.srcObject=camera;await video.play();}return camera;}), locationPromise]);
      if (closed || captureAttempt.cancelled) { camera.getTracks().forEach(t => t.stop()); return; }
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      if(closed||captureAttempt.cancelled||attempt!==captureAttempt)return;
      const vision = await FilesetResolver.forVisionTasks('/vision/wasm');
      if (closed || captureAttempt.cancelled) return;
      const createdDetector = await FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: '/vision/blaze_face_short_range.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.65 });
      if (closed || captureAttempt.cancelled) { createdDetector.close(); return; }
      detector = createdDetector;
      clearTimeout(setupWatchdog); setupWatchdog = undefined;
      let stableFrames = 0, countdownStart = 0, lastVideoTime = -1;
      const status = root.querySelector('#demo-status'); const count = root.querySelector('#countdown');
      status.textContent = 'Center one face in the frame. A 3-second countdown starts when you’re ready.';
      const deadline = performance.now() + 60000;
      timer = setInterval(async () => {
        if (closed || !detector || attempt!==captureAttempt) return;
        if (performance.now() > deadline) { stopCamera(); failure('No capture was made. The camera timed out after one minute. You can try again.'); return; }
        if(video.readyState<2||video.currentTime===lastVideoTime)return;
        try {
          lastVideoTime = video.currentTime;
          const result = detector.detectForVideo(video, performance.now());
          const faces = result.detections || [];
          if (faces.length !== 1) { stableFrames = 0; countdownStart = 0; count.hidden = true; status.textContent = faces.length > 1 ? 'Please keep only one person in the frame.' : 'Center your face in the frame to start the countdown.'; return; }
          stableFrames++;
          if (stableFrames < 4) return;
          countdownStart ||= performance.now();
          const remaining = 3 - Math.floor((performance.now() - countdownStart) / 1000);
          count.hidden = false; count.textContent = String(Math.max(1, remaining));
          status.textContent = 'Face detected. Your photo will be taken automatically. You can still cancel.';
          if (remaining > 0) return;
          clearInterval(timer);
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 1280 / video.videoWidth); canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
          if(closed||captureAttempt.cancelled||attempt!==captureAttempt)return;
          stopCamera(false);
          if (!blob) throw new Error('The camera frame could not be captured.');
          payload = { blob, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, consentAt, consentText: localOnly?localDisclosure:disclosure, token, tokenExpiresAt, requestId: uuid(), localOnly };
          if(localOnly)showDeviceResult();
          else if(import.meta.env.VITE_TURNSTILE_SITE_KEY&&!usableBotToken(token,tokenExpiresAt))failure('Complete a fresh bot check to send the captured photo. Your camera is off.',true);
          else await send();
        } catch (error) { if(closed||attempt!==captureAttempt)return;stopCamera();failure(error.message); }
      }, 200);
    } catch (error) {
      if(closed||attempt!==captureAttempt||captureAttempt.cancelled)return;
      stopCamera();
      let message = error.message;
      if (error.name === 'NotAllowedError' || error.code === 1) message = 'Camera or location permission was declined. Nothing was submitted. Allow both permissions if you want to try again.';
      else if (error.code === 3) message = 'Your browser could not determine a location within 45 seconds. Nothing was submitted. Check location access in your browser and operating system, or try this Lab on your phone.';
      else if (error.code === 2) message = 'Your browser could not determine a location. Nothing was submitted. Check your connection and device location services, or try your phone.';
      else if (error.name === 'NotFoundError') message = 'No camera was found. Connect a webcam or try this Lab on your phone. Nothing was submitted.';
      else if (error.name === 'NotReadableError') message = 'The camera could not be opened. Close other apps using it and try again. Nothing was submitted.';
      failure(message || 'The demo could not start. Nothing was submitted.');
    }
  }

  function showDeviceResult(){
    if(closed||!payload)return;
    previewUrl=URL.createObjectURL(payload.blob);
    layout(`<img class="device-photo" src="${esc(previewUrl)}" alt="Your device-only camera test photo"><dl class="device-location"><dt>Latitude</dt><dd>${esc(payload.latitude)}</dd><dt>Longitude</dt><dd>${esc(payload.longitude)}</dd><dt>Estimated accuracy</dt><dd>±${esc(Math.round(payload.accuracy))} metres</dd></dl><p class="local-warning">Device-only test complete. Your camera is off. No photo or location was uploaded or emailed.</p><button class="button button-primary" id="discard-device-test">Discard and close</button>`, 'DEVICE-ONLY TEST');
    root.querySelector('#discard-device-test').onclick=()=>close();root.querySelector('#discard-device-test').focus();
  }

  async function send() {
    if (closed || !payload || payload.localOnly) return;
    if(import.meta.env.VITE_TURNSTILE_SITE_KEY&&!usableBotToken(payload.token,payload.tokenExpiresAt)){
      const error=root.querySelector('.form-error');if(error)error.textContent='Wait for Cloudflare verification to finish before retrying. Your camera is off.';
      return;
    }
    captcha?.destroy(); captcha = undefined;
    layout(`<div class="processing-ring" data-sending>${icon('spark')}</div><p class="demo-status" role="status">Sending your photo and location…</p><p class="consent-note">Your camera is now off. Please keep this window open.</p>`, 'EMAIL TO PORTFOLIO OWNER');
    // After capture the browser cannot reliably retract a request already accepted by a server.
    root.querySelector('.modal-close').disabled = true;
    const data = new FormData();
    data.set('photo', payload.blob, 'capture.jpg'); data.set('latitude', String(payload.latitude)); data.set('longitude', String(payload.longitude)); data.set('accuracy', String(payload.accuracy));
    data.set('consent', 'true'); data.set('consentVersion', CONSENT_VERSION); data.set('consentAt', payload.consentAt); data.set('consentText', payload.consentText); data.set('requestId', payload.requestId); data.set('turnstileToken', payload.token);
    // The server may consume the token even if its response is lost.
    payload.token='';payload.tokenExpiresAt=0;
    try {
      const result = await submitPublic('submit-visit', data);
      if (closed) return;
      if(result.status!=='accepted'||typeof result.id!=='string')throw new Error('The server did not confirm email acceptance. Retry with this same submission reference.');
      acceptedResult=result;
      try{sessionStorage.setItem('nabin-demo-reference', result.id);}catch{}
      payload=undefined;
      layout(`<div class="demo-complete">${icon('check')}</div><p class="demo-status" role="status">The email service accepted your submission.</p><p class="consent-note">Recipient: ${esc(settings.email)}<br>Reference: ${esc(result.id)}</p><p class="consent-note">Acceptance does not confirm inbox delivery.</p><button class="button button-primary" id="submission-done">Done ${icon('check')}</button>`, 'SUBMISSION ACCEPTED');
      root.querySelector('#submission-done').onclick=()=>close(true);root.querySelector('#submission-done').focus();
      if(required)completionTimer=setTimeout(()=>close(true),1200);
    } catch (error) { if (!closed) failure(error.name === 'TimeoutError' ? 'The request timed out. Retry to check the same submission. It may already have been accepted.' : error.message, true); }
  }

  function failure(message, retrySend = false) {
    layout(`<p class="form-error" role="alert">${esc(message)}</p><p class="consent-note">${retrySend ? 'The photo is retained in this window for retry. The server may already have received the submission; the same reference is reused to avoid duplicate emails.' : 'No new submission has been sent. Your camera is off.'}</p><div id="retry-turnstile"></div><button class="button button-primary" id="retry-demo">${retrySend ? 'Retry submission' : 'Try again'}${icon('arrow')}</button><button class="button button-outline" id="cancel-retry">Close demo</button>`, 'LET’S TRY THAT AGAIN');
    const retry=root.querySelector('#retry-demo');
    if(retrySend){captcha?.destroy();captcha=undefined;retry.disabled=true;}
    retry.onclick = retrySend ? async () => {
      const token=captcha?.token()||'',expiresAt=captcha?.expiresAt()||0;
      if(!usableBotToken(token,expiresAt)){retry.disabled=true;return;}
      payload.token=token;payload.tokenExpiresAt=expiresAt;await send();
    } : async () => { captcha?.destroy(); captcha = undefined; await initial(); };
    root.querySelector('#cancel-retry').onclick = () => close();
    root.querySelector('#retry-demo').focus();
    if (retrySend) mountTurnstile(root.querySelector('#retry-turnstile'),{onChange:token=>{if(!closed&&retry.isConnected)retry.disabled=!token;}}).then(value => { if (closed||!retry.isConnected)value.destroy();else{captcha=value;retry.disabled=!value.token();} }).catch(() => {if(!closed&&retry.isConnected)root.querySelector('.form-error').textContent='The bot check could not load. Check your connection, then close and reopen the entry prompt.';});
  }
  initial();
  return () => close();
}
