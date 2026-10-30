import { HttpError, limitedFormData, requestId, validateConsent, validateCoordinates, validateFile } from './validation.ts';
import { db, checkRate, checkOwnerDisclosure, checkTurnstile, claimSubmission, digest, handlePublic, json, sendMail, storeFile } from './runtime.ts';

export function visitHandler(request: Request, deps: {client?: ReturnType<typeof db>} = {}) {
return handlePublic(request, async headers => {
  const client = deps.client || db(); await checkRate(request, client, 'visit');
  await checkOwnerDisclosure(client);
  const form = await limitedFormData(request); const id = requestId(form); const consent = validateConsent(form); const coords = validateCoordinates(form);
  await checkTurnstile(form);
  const file = await validateFile(form.get('photo'), true, true);
  if (!file) throw new HttpError(400, 'A photo is required.');
  const filePath = `visit/${id}.jpg`;
  const payloadHash = await digest(JSON.stringify({ ...consent, ...coords, photoHash: await digest(file.bytes) }));
  const row = await claimSubmission(client, { id, kind: 'visit', payload_hash: payloadHash, file_path: filePath, file_name: 'capture.jpg', latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, consent_version: consent.consentVersion, consent_at: consent.consentAt, consent_text: consent.consentText });
  if (row.email_status === 'accepted') return json({ ok: true, id, status: 'accepted' }, 200, headers);
  await storeFile(client, filePath, file);
  let emailId;
  try { emailId = await sendMail({ id, kind: 'visit', subject: 'Portfolio lab: consented camera and location submission', text: `Educational camera + location demo\n\nSubmission reference: ${id}\nLatitude: ${coords.latitude}\nLongitude: ${coords.longitude}\nAccuracy: ±${coords.accuracy} metres\nConsent version: ${consent.consentVersion}\nConsent timestamp: ${consent.consentAt}\n\nDisclosure shown to participant:\n${consent.consentText}\n\nThe full-frame photo is attached. Face detection was performed locally in the browser. This is not identity verification or a CAPTCHA.\nDelete emailed copies separately if a participant requests deletion.`, attachment: file }); }
  catch (error) { await client.from('submissions').update({ email_status: 'failed' }).eq('id', id).neq('email_status', 'accepted'); throw error; }
  const { error } = await client.from('submissions').update({ email_status: 'accepted', email_id: emailId }).eq('id', id);
  if (error) throw new HttpError(503, 'The email was accepted, but confirmation could not be saved. Retry with this same reference.');
  return json({ ok: true, id, status: 'accepted' }, 200, headers);
});
}
