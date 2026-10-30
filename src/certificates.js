import { esc, icon, lines, safeUrl, formatDate } from './utils.js';
import { mediaUrl } from './local-media.js';

export function publicCertificates(records) {
  return records.filter(record => record.is_published && !record.data?.sample && mediaUrl(record.data?.imageUrl));
}

export function certificateCard(record, ui) {
  if (!publicCertificates([record]).length) return '';
  const d = record.data;
  const src = mediaUrl(d.imageUrl);
  return `<article class="certificate-card" data-certificate-card="${esc(record.id)}"><button class="certificate-image-button" data-certificate-open="${esc(record.id)}" aria-label="${esc(ui.viewLabel)}: ${esc(record.title)}"><img src="${esc(src)}" alt="${esc(record.title)} certificate" loading="lazy" decoding="async"><span class="certificate-zoom">${icon('search')}</span></button><div class="certificate-copy"><div><span class="small-label">${esc(d.issuer)}</span><h3>${esc(record.title)}</h3><p>${d.issuedDate ? esc(formatDate(d.issuedDate)) : ''}</p></div><span class="certificate-seal">${icon('shield')}</span></div></article>`;
}

export function certificateSection(records, ui, { page = false } = {}) {
  records = publicCertificates(records);

  return `<section class="section certificates-section" id="certificates"><div class="section-heading reveal"><div><div class="eyebrow"><span></span>${esc(ui.eyebrow)}</div><h2>${lines(ui.title)}</h2><p>${esc(ui.intro)}</p></div>${!page ? `<a href="/certificates" data-link class="text-link">${esc(ui.allLabel)} ${icon('diagonal')}</a>` : ''}</div>${records.length ? `<div class="certificate-carousel" data-certificate-carousel role="region" aria-roledescription="carousel" aria-label="${esc(ui.title.replaceAll('\n', ' '))}"><div class="certificate-stage" data-certificate-stage>${records.map(record => certificateCard(record, ui)).join('')}</div><div class="certificate-controls"><div class="certificate-dots" aria-label="Choose a certificate">${records.map((record, index) => `<button data-certificate-dot="${index}" aria-label="${esc(ui.viewLabel)} ${index + 1}: ${esc(record.title)}" aria-pressed="${index === 0}"></button>`).join('')}</div><p class="certificate-counter" aria-live="off" data-certificate-status>01 / ${String(records.length).padStart(2,'0')}</p><div class="certificate-buttons"><button class="icon-button carousel-play" data-certificate-play aria-label="${esc(ui.pauseLabel)}">Ⅱ</button><button class="icon-button" data-certificate-prev aria-label="${esc(ui.previousLabel)}">${icon('arrow')}</button><button class="icon-button" data-certificate-next aria-label="${esc(ui.nextLabel)}">${icon('arrow')}</button></div></div></div>` : `<div class="certificate-gallery-idle" aria-hidden="true"><span class="certificate-idle-orbit"></span><span class="certificate-idle-seal">${icon('shield')}</span><span class="certificate-idle-spark">✳</span></div>`}</section>`;
}

export function relativeSlide(index, active, length) {
  if (length < 2) return 0;
  let relative = (index - active + length) % length;
  if (relative > length / 2) relative -= length;
  return relative;
}

export function bindCertificates(records, ui, { motionPaused = false } = {}) {
  records = publicCertificates(records);
  const cleanups = [];
  for (const carousel of document.querySelectorAll('[data-certificate-carousel]')) {
    let active = 0, timer, hover = false, focus = false, gestureStart, dragged = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let playing = Boolean(ui.autoplay) && !motionPaused && !reduced.matches;
    const cards = [...carousel.querySelectorAll('[data-certificate-card]')];
    const dots = [...carousel.querySelectorAll('[data-certificate-dot]')];
    const play = carousel.querySelector('[data-certificate-play]');
    const stage = carousel.querySelector('[data-certificate-stage]');
    function schedule() {
      clearInterval(timer);
      if (playing && !hover && !focus && !document.hidden && !document.querySelector('#certificate-lightbox') && cards.length > 1) timer = setInterval(() => show(active + 1), Math.max(3, Math.min(30, Number(ui.intervalSeconds) || 5)) * 1000);
    }
    function show(index) {
      active = (index + cards.length) % cards.length;
      cards.forEach((card, i) => {
        const offset = relativeSlide(i, active, cards.length);
        card.style.setProperty('--slide-offset', Math.max(-2, Math.min(2, offset)));
        card.classList.toggle('certificate-active', offset === 0);
        card.classList.toggle('certificate-outside', Math.abs(offset) > 1);
        card.setAttribute('aria-hidden', String(offset !== 0)); card.inert = offset !== 0;
      });
      dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === active)));
      carousel.querySelector('[data-certificate-status]').textContent = `${String(active + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      play.textContent = playing ? 'Ⅱ' : '▷'; play.setAttribute('aria-label', playing ? ui.pauseLabel : ui.playLabel); play.setAttribute('aria-pressed', String(playing));
    }
    function step(delta) { show(active + delta); schedule(); }
    carousel.querySelector('[data-certificate-prev]').onclick = () => step(-1);
    carousel.querySelector('[data-certificate-next]').onclick = () => step(1);
    dots.forEach((dot, i) => dot.onclick = () => { show(i); schedule(); });
    play.onclick = () => { playing = !playing; show(active); schedule(); };
    carousel.onmouseenter = () => { hover = true; schedule(); }; carousel.onmouseleave = () => { hover = false; schedule(); };
    const focusIn = () => { focus = true; schedule(); };
    const focusOut = event => { focus = carousel.contains(event.relatedTarget); schedule(); };
    carousel.addEventListener('focusin',focusIn); carousel.addEventListener('focusout',focusOut);
    stage.onpointerdown = event => { gestureStart = {x:event.clientX,y:event.clientY}; dragged = false; };
    stage.onpointerup = event => {
      if (!gestureStart) return;
      const dx = event.clientX - gestureStart.x, dy = event.clientY - gestureStart.y; gestureStart = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { dragged = true; step(dx < 0 ? 1 : -1); }
    };
    stage.onpointercancel = () => { gestureStart = null; };
    const blockSwipeClick = event => { if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; } };
    stage.addEventListener('click', blockSwipeClick, true);
    const visibility = () => schedule(); document.addEventListener('visibilitychange', visibility);
    const preference = () => { if (reduced.matches) { playing = false; show(active); schedule(); } };
    reduced.addEventListener('change', preference);
    show(0); schedule();
    cleanups.push(() => { clearInterval(timer); stage.removeEventListener('click',blockSwipeClick,true); carousel.removeEventListener('focusin',focusIn); carousel.removeEventListener('focusout',focusOut); document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', preference); });
  }
  const openButtons = document.querySelectorAll('[data-certificate-open]');
  openButtons.forEach(button => button.onclick = () => {
    const record = records.find(item => item.id === button.dataset.certificateOpen); if (!record) return;
    showCertificate(record, ui);
  });
  return () => { cleanups.forEach(fn => fn()); document.querySelector('#certificate-lightbox')?.close(); };
}

function showCertificate(record, ui) {
  if (!publicCertificates([record]).length) return;
  const src = mediaUrl(record.data.imageUrl);
  const dialog = document.createElement('dialog'); dialog.id = 'certificate-lightbox'; dialog.className = 'certificate-lightbox';
  dialog.innerHTML = `<div class="certificate-lightbox-top"><div><span class="small-label">${esc(record.data.issuer)}</span><h2>${esc(record.title)}</h2></div><button class="icon-button" aria-label="${esc(ui.closeLabel)}">${icon('close')}</button></div><img class="certificate-full-image" src="${esc(src)}" alt="${esc(record.title)} certificate"><div class="certificate-lightbox-bottom"><div><p>${esc(record.data.description)}</p>${record.data.credentialId ? `<small>ID: ${esc(record.data.credentialId)}</small>` : ''}<div class="tags">${(record.data.skills || []).map(skill => `<span>${esc(skill)}</span>`).join('')}</div></div>${safeUrl(record.data.credentialUrl) ? `<a class="button button-primary" href="${esc(safeUrl(record.data.credentialUrl))}" target="_blank" rel="noopener noreferrer">${esc(ui.verifyLabel)}${icon('external')}</a>` : ''}</div>`;
  document.getElementById('modal-root').append(dialog);
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds=dialog.getBoundingClientRect(); if (event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close(); } });
  dialog.showModal();
}
