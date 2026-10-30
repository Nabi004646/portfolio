export function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function safeUrl(value = '', { image = false } = {}) {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
export function markdown(text = '') {
  // Deliberately small, escaped Markdown subset. Raw HTML is always rendered as text.
  return String(text).split(/\n\s*\n/).map(block => {
    if (block.startsWith('## ')) return `<h2>${esc(block.slice(3))}</h2>`;
    if (block.startsWith('### ')) return `<h3>${esc(block.slice(4))}</h3>`;
    if (block.split('\n').every(line => line.startsWith('- '))) return `<ul>${block.split('\n').map(line => `<li>${esc(line.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${esc(block).replaceAll('\n', '<br>')}</p>`;
  }).join('');
}
export const lines = text => esc(text).replaceAll('\n', '<br>');
export const slugify = (text,maximum=80) => String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, maximum).replace(/-$/,'');
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // getRandomValues also works on HTTP development previews. This is not an
  // authentication credential; the backend still validates every request.
  const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = bytes[6] & 15 | 64; bytes[8] = bytes[8] & 63 | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export const formatDate = value => { const d = new Date(`${value}T12:00:00Z`); return Number.isNaN(d.valueOf()) ? '' : d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }); };
export function toast(message, error = false) {
  const root = document.getElementById('toast-root');
  const item = document.createElement('div'); item.className = `toast${error ? ' toast-error' : ''}`; item.textContent = message; root.append(item); setTimeout(() => item.remove(), 5500);
}
export const icon = (name, extra = '') => `<svg class="icon ${extra}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9zM2 15l10 6 10-6M2 12l10 6 10-6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1 .2-2-1-3 4 0 7-2 7-6 0-2-1-3-2-4 0-1 0-3-1-3-2 0-3 1-4 1-2-1-4-1-6 0-1 0-2-1-4-1-1 0-1 2-1 3-1 1-2 2-2 4 0 4 3 6 7 6-1 1-1 2-1 3v4"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10v7m0-10v.1M11 17v-7m0 3c0-4 6-4 6 0v4"/>',
  facebook: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M14.5 7H13a2 2 0 0 0-2 2v12m-3-9h7l.5-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 4 9 9 0 1 0 20 14Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  camera: '<path d="m8 5 1-2h6l1 2h4v15H4V5z"/><circle cx="12" cy="12" r="4"/>',
  settings: '<path d="m9 3-.5 3-3 1-2-1-2 4 2 2v2l-2 2 2 4 3-1 2 1 .5 3h5l.5-3 3-1 2 1 2-4-2-2v-2l2-2-2-4-3 1-2-1-.5-3z"/><circle cx="12" cy="13" r="3"/>',
  file: '<path d="M13 3H5v18h14V9zM13 3v6h6"/>', trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="m15 3 6 6M3 21l5-1L21 7l-4-4L4 16z"/>',
  logout: '<path d="M9 3H4v18h5m5-14 5 5-5 5m-5-5h13"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>', spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  book: '<path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Zm0 0v15"/>',
  external: '<path d="M14 3h7v7m-10 3L21 3M10 3H3v18h18v-7"/>',
}[name] || '<circle cx="12" cy="12" r="8"/>')}</svg>`;
