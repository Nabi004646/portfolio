import { HttpError, limitedFormData, requestId, validateContact, validateFile } from '../_shared/validation.ts';
import { db, checkRate, checkOwnerDisclosure, checkTurnstile, claimSubmission, digest, handlePublic, json, sendMail, storeFile } from '../_shared/runtime.ts';

Deno.serve(request => handlePublic(request, async headers => {
  const client = db(); await checkRate(request, client, 'contact');
  await checkOwnerDisclosure(client);
  const form = await limitedFormData(request); const id = requestId(form); const details = validateContact(form);
  await checkTurnstile(form);
  const file = await validateFile(form.get('attachment'));
  const filePath = file ? `contact/${id}.${file.ext}` : null;
  const payloadHash = await digest(JSON.stringify({ ...details, fileName: file?.name || '', fileHash: file ? await digest(file.bytes) : '' }));
  const row = await claimSubmission(client, { id, kind: 'contact', payload_hash: payloadHash, ...details, file_path: filePath, file_name: file?.name || null, consent_version: 'contact-v1', consent_at: new Date().toISOString(), consent_text: 'I agree to send this message and any attachment to the portfolio owner.' });
  if (row.email_status === 'accepted') return json({ ok: true, id, status: 'accepted' }, 200, headers);
  if (file && filePath) await storeFile(client, filePath, file);
  let emailId;
  try { emailId = await sendMail({ id, kind: 'contact', subject: `Portfolio message: ${details.subject.replace(/[\r\n]/g, ' ')}`, replyTo: details.email, text: `New portfolio message\n\nFrom: ${details.name} <${details.email}>\nSubject: ${details.subject}\n\n${details.message}\n\nSubmission reference: ${id}\nAttachment: ${file?.name || 'none'}\n\nSubmitted through the disclosed contact form.`, attachment: file }); }
  catch (error) { await client.from('submissions').update({ email_status: 'failed' }).eq('id', id).neq('email_status', 'accepted'); throw error; }
  const { error } = await client.from('submissions').update({ email_status: 'accepted', email_id: emailId }).eq('id', id);
  if (error) throw new HttpError(503, 'The email was accepted, but confirmation could not be saved. Retry with this same reference.');
  return json({ ok: true, id, status: 'accepted' }, 200, headers);
}));
