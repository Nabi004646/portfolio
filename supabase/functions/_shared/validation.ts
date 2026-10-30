export const CONSENT_VERSION = '2026-10-30-v1';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function text(form: FormData, name: string, min: number, max: number): string {
  const value = form.get(name);
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new HttpError(400, `Check the ${name} field.`);
  return value.trim();
}
export function requestId(form: FormData): string {
  const value = text(form, 'requestId', 36, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new HttpError(400, 'A valid submission reference is required.');
  return value.toLowerCase();
}
export function validateConsent(form: FormData, now = Date.now()) {
  if (form.get('consent') !== 'true' || form.get('consentVersion') !== CONSENT_VERSION) throw new HttpError(400, 'Explicit consent to this demo is required.');
  const consentAt = text(form, 'consentAt', 20, 40);
  const time = Date.parse(consentAt);
  if (!Number.isFinite(time) || time > now + 60000 || time < now - 20 * 60 * 1000) throw new HttpError(400, 'This consent session has expired. Please start the demo again.');
  const consentText = text(form, 'consentText', 100, 2000);
  if (!/photo/i.test(consentText) || !/location/i.test(consentText) || !/email/i.test(consentText)) throw new HttpError(400, 'The capture and email disclosure is required.');
  return { consentAt, consentText, consentVersion: CONSENT_VERSION };
}
export function validateCoordinates(form: FormData) {
  function numeric(name: string, min: number, max: number) {
    const raw = form.get(name);
    if (typeof raw !== 'string' || !raw.trim()) throw new HttpError(400, `A valid ${name} is required.`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) throw new HttpError(400, `A valid ${name} is required.`);
    return value;
  }
  return { latitude: numeric('latitude', -90, 90), longitude: numeric('longitude', -180, 180), accuracy: numeric('accuracy', 0, 10000000) };
}
export function validateContact(form: FormData) {
  if (form.get('website')) throw new HttpError(400, 'Submission could not be accepted.');
  if (form.get('consent') !== 'true') throw new HttpError(400, 'Please agree to send your message.');
  const name = text(form, 'name', 2, 100);
  const email = text(form, 'email', 3, 254);
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  const subject = text(form, 'subject', 1, 150);
  const message = text(form, 'message', 10, 5000);
  return { name, email, subject, message };
}
export async function validateFile(file: FormDataEntryValue | null, required = false, photo = false) {
  if (!(file instanceof File) || file.size === 0) {
    if (required) throw new HttpError(400, 'A captured photo is required.');
    return null;
  }
  if (file.size > MAX_FILE_BYTES) throw new HttpError(413, 'The file must be under 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = file.type;
  const jpeg = bytes.length > 20 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  const png = bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v);
  const webp = bytes.length >= 20 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  const pdf = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  if (photo && (type !== 'image/jpeg' || !jpeg)) throw new HttpError(400, 'The camera photo must be a valid JPEG.');
  const valid = type === 'image/jpeg' && jpeg || type === 'image/png' && png || type === 'image/webp' && webp || type === 'application/pdf' && pdf && !photo;
  if (!valid) throw new HttpError(400, 'Choose a supported JPG, PNG, WebP, or PDF. File contents must match its type.');
  if (png) { const view = new DataView(bytes.buffer); const width = view.getUint32(16), height = view.getUint32(20); if (!width || !height || width > 8192 || height > 8192) throw new HttpError(400, 'This image has unsupported dimensions.'); }
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as Record<string, string>)[type];
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || `attachment.${ext}`;
  return { bytes, type, ext, name: photo ? 'capture.jpg' : safeName };
}
export async function limitedFormData(request: Request, maximum = 7 * 1024 * 1024) {
  if (!(request.headers.get('content-type') || '').startsWith('multipart/form-data;')) throw new HttpError(415, 'Use a multipart form submission.');
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximum) throw new HttpError(413, 'This submission is too large.');
  if (!request.body) throw new HttpError(400, 'A form body is required.');
  const reader = request.body.getReader(); let total = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maximum) { await reader.cancel(); throw new HttpError(413, 'This submission is too large.'); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return await new Response(bytes, { headers: { 'content-type': request.headers.get('content-type')! } }).formData(); }
  catch { throw new HttpError(400, 'The form could not be read.'); }
}
