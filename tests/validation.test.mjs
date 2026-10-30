import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConsent, validateCoordinates, validateContact, validateFile, limitedFormData, requestId, CONSENT_VERSION } from '../supabase/functions/_shared/validation.ts';
import { esc, safeUrl, markdown } from '../src/utils.js';

const contact = () => { const f = new FormData(); Object.entries({name:'Test Student',email:'test@example.com',subject:'A project idea',message:'A test message with enough detail.',consent:'true',requestId:'835087fd-4826-4c04-8898-a788f95efe18'}).forEach(([k,v])=>f.set(k,v)); return f; };
const consent = () => { const f = new FormData(); Object.entries({consent:'true',consentVersion:CONSENT_VERSION,consentAt:new Date().toISOString(),consentText:'Continuing automatically captures a photo from the camera and requests your location. Both the photo and coordinates will be sent to the portfolio owner by email.'}).forEach(([k,v])=>f.set(k,v)); return f; };

test('visit requests require explicit, current consent and email disclosure', () => {
  assert.equal(validateConsent(consent()).consentVersion, CONSENT_VERSION);
  for (const [key,value] of [['consent','false'],['consentVersion','old'],['consentAt','2020-01-01T00:00:00Z'],['consentAt','not-a-date'],['consentText','Click here']]) { const f=consent(); f.set(key,value); assert.throws(()=>validateConsent(f)); }
});
test('coordinates reject missing, nonfinite, and out-of-range values', () => {
  const f=new FormData(); Object.entries({latitude:'27.7',longitude:'85.3',accuracy:'25'}).forEach(([k,v])=>f.set(k,v));
  assert.deepEqual(validateCoordinates(f),{latitude:27.7,longitude:85.3,accuracy:25});
  for(const [k,v] of [['latitude','91'],['latitude',''],['longitude','NaN'],['accuracy','-1'],['accuracy','Infinity']]) { const copy=new FormData(); for(const [key,value] of f)copy.set(key,value); copy.set(k,v); assert.throws(()=>validateCoordinates(copy)); }
});
test('contact refuses absent consent, spam honeypots, malformed email, and short messages', () => {
  assert.equal(validateContact(contact()).email,'test@example.com');
  for (const [key,value] of [['consent','false'],['email','evil\r\nBcc:other@example.com'],['message','short'],['website','https://spam.example']]) { const f=contact(); f.set(key,value); assert.throws(()=>validateContact(f)); }
});
test('submission reference cannot inject paths or replace UUIDs', () => {
  assert.match(requestId(contact()),/^[a-f0-9-]{36}$/); const f=contact(); f.set('requestId','../../secrets'); assert.throws(()=>requestId(f));
});
test('uploads check bytes as well as MIME and reject executables, SVG, and oversized files', async () => {
  await assert.rejects(validateFile(new File(['<svg onload=alert(1)>'],'image.png',{type:'image/png'})));
  await assert.rejects(validateFile(new File(['MZ'+'a'.repeat(50)],'app.exe',{type:'image/jpeg'})));
  await assert.rejects(validateFile(new File(['<svg/>'],'image.svg',{type:'image/svg+xml'})));
  await assert.rejects(validateFile(new File([new Uint8Array(5242881)],'big.pdf',{type:'application/pdf'})));
  const pdf=await validateFile(new File(['%PDF-1.7\nTest file content'],'../../brief.pdf',{type:'application/pdf'}));
  assert.equal(pdf.ext,'pdf'); assert.ok(!pdf.name.includes('/'));
  await assert.rejects(validateFile(new File(['%PDF-1.7\nTest file content'],'photo.pdf',{type:'application/pdf'}),true,true));
  const jpeg=new Uint8Array(32);jpeg.set([255,216,255]);jpeg.set([255,217],30);
  assert.equal((await validateFile(new File([jpeg],'capture.jpg',{type:'image/jpeg'}),true,true)).ext,'jpg');
});
test('missing attachment is optional but missing camera photo is rejected', async () => {
  assert.equal(await validateFile(null),null); await assert.rejects(validateFile(null,true,true));
});
test('multipart parser bounds bodies even without Content-Length', async () => {
  const form=contact(); const req=new Request('https://example.com',{method:'POST',body:form});
  assert.equal((await limitedFormData(req)).get('email'),'test@example.com');
  const huge=new Request('https://example.com',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=test'},body:'x'.repeat(1000)});
  await assert.rejects(limitedFormData(huge,100));
  await assert.rejects(limitedFormData(new Request('https://example.com',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})));
});
test('content and links remain inert when an editor includes scripts or unsafe URLs', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');
  for(const url of ['javascript:alert(1)','data:text/html,hello','//evil.example','/\\evil.example','http://example.com'])assert.equal(safeUrl(url),'');
  assert.equal(safeUrl('/projects'),'\/projects'); assert.equal(safeUrl('https://example.com'),'https://example.com/');
  const html=markdown('## A title\n\n<script>alert(1)</script>');assert.ok(html.includes('<h2>A title</h2>'));assert.ok(!html.includes('<script>'));
});
