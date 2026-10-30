import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { HttpError } from './validation.ts';

export function env(name: string, fallback = '') { return Deno.env.get(name) || fallback; }
export function db() {
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new HttpError(503, 'The project backend is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function originHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowed = env('ALLOWED_ORIGINS').split(',').map(x => x.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) throw new HttpError(403, 'This website origin is not allowed.');
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Vary': 'Origin', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
}
export function json(data: unknown, status: number, headers: Record<string,string>) { return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } }); }
export async function digest(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : Uint8Array.from(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
}
async function rateKey(value: string) {
  const secret = env('IP_HASH_SECRET');
  if (secret.length < 32 || secret.startsWith('REPLACE_')) throw new HttpError(503, 'The submission service is not configured.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(mac)).map(v => v.toString(16).padStart(2, '0')).join('');
}
export async function checkRate(request: Request, client: ReturnType<typeof db>, kind: string) {
  // X-Forwarded-For is set by the hosting proxy. Only take its first hop; this is
  // defense in depth, alongside Turnstile and a global budget, not authentication.
  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const keys = await Promise.all([rateKey(`${kind}:${ip}`), rateKey(`${kind}:global`)]);
  for (const [index, key] of keys.entries()) {
    const { data, error } = await client.rpc('portfolio_take_rate_limit', { p_key: key, p_limit: index === 0 ? kind === 'visit' ? 5 : 8 : 100 });
    if (error) throw new HttpError(503, 'Submission checks are temporarily unavailable.');
    if (!data) throw new HttpError(429, 'Too many attempts. Please try again in 10 minutes.');
  }
}
export async function checkOwnerDisclosure(client: ReturnType<typeof db>) {
  const { data, error } = await client.from('content_items').select('data').eq('id', 'settings').single();
  const displayed = String(data?.data?.email || '').trim().toLowerCase();
  const actual = env('OWNER_EMAIL').trim().toLowerCase();
  if (error || !actual || displayed !== actual) throw new HttpError(503, 'The owner email and the displayed disclosure must be configured consistently.');
}
export async function checkTurnstile(form: FormData) {
  if (env('REQUIRE_TURNSTILE', 'true') !== 'true') return;
  const secret = env('TURNSTILE_SECRET_KEY');
  const token = form.get('turnstileToken');
  if (!secret || /^(REPLACE_|YOUR_)/i.test(secret)) throw new HttpError(503, 'Bot protection is not configured: the owner must set TURNSTILE_SECRET_KEY in Supabase Edge Function Secrets.');
  const hosts = env('TURNSTILE_HOSTNAMES').split(',').map(x => x.trim()).filter(Boolean);
  if(!hosts.length)throw new HttpError(503,'Bot protection is not configured: the owner must set TURNSTILE_HOSTNAMES.');
  if (typeof token !== 'string' || !token || token.length > 2048) throw new HttpError(400, 'Complete the bot check and try again.');
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, response: token }), signal: AbortSignal.timeout(10000) });
  const result = await response.json();
  if((result['error-codes']||[]).some((code:string)=>['invalid-input-secret','missing-input-secret'].includes(code)))throw new HttpError(503,'Bot protection configuration failed. The owner must save the secret matching this Turnstile widget in Supabase.');
  if (!response.ok || !result.success || !hosts.length || !hosts.includes(result.hostname)) throw new HttpError(400, 'The bot check expired or did not verify. Please try again.');
}
export function toBase64(bytes: Uint8Array) {
  let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(binary);
}
export async function sendMail({ id, kind, subject, text, replyTo, attachment }: { id: string; kind: string; subject: string; text: string; replyTo?: string; attachment?: { bytes: Uint8Array; name: string } | null }) {
  const key = env('RESEND_API_KEY'), from = env('MAIL_FROM'), owner = env('OWNER_EMAIL');
  if (!key || key.includes('REPLACE') || !from || !owner) throw new HttpError(503, 'Email delivery is not configured yet.');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `${kind}/${id}` }, body: JSON.stringify({ from, to: [owner], subject, text, ...(replyTo ? { reply_to: replyTo } : {}), ...(attachment ? { attachments: [{ filename: attachment.name, content: toBase64(attachment.bytes) }] } : {}) }), signal: AbortSignal.timeout(25000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) throw new HttpError(502, 'The email service could not accept this submission. Please retry.');
  return String(result.id);
}
export async function claimSubmission(client: ReturnType<typeof db>, row: Record<string,unknown>) {
  const { error } = await client.from('submissions').insert(row);
  if (error && error.code !== '23505') throw new HttpError(503, 'The submission could not be stored.');
  const { data, error: readError } = await client.from('submissions').select('id, payload_hash, email_status, email_id, created_at').eq('id', row.id).single();
  if (readError || !data) throw new HttpError(503, 'The submission could not be checked.');
  if (data.payload_hash !== row.payload_hash) throw new HttpError(409, 'This reference belongs to a different submission. Start a new submission.');
  if (data.email_status !== 'accepted' && Date.now() - Date.parse(data.created_at) > 20 * 60 * 1000) throw new HttpError(409, 'This submission is too old to retry. Start a new submission.');
  return data;
}
export async function storeFile(client: ReturnType<typeof db>, path: string, file: { bytes: Uint8Array; type: string }) {
  const { error } = await client.storage.from('portfolio-private').upload(path, file.bytes, { contentType: file.type, upsert: false });
  // A retry reuses the deterministic path after the stored payload hash matches.
  if (error && !['409', '400'].includes(String(error.statusCode)) && !/already exists|duplicate/i.test(error.message)) throw new HttpError(503, 'The attachment could not be stored. Please retry.');
  if (error && !/already exists|duplicate/i.test(error.message) && String(error.statusCode) !== '409') throw new HttpError(503, 'The attachment could not be stored. Please retry.');
}
export async function handlePublic(request: Request, handler: (headers: Record<string,string>) => Promise<Response>) {
  let headers: Record<string,string> = { 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  try {
    headers = originHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') throw new HttpError(405, 'Use a POST form submission.');
    return await handler(headers);
  } catch (error) {
    const known = error instanceof HttpError;
    // Never log the form, coordinates, image, email contents, or secrets.
    return json({ ok: false, error: known ? error.message : 'The submission service is temporarily unavailable. Please retry.' }, known ? error.status : 503, headers);
  }
}
