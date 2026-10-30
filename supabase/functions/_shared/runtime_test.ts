import { checkTurnstile, handlePublic, originHeaders, sendMail, toBase64 } from './runtime.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition { if (!condition) throw new Error(message); }
const originalFetch = globalThis.fetch;
function setup() {
  Deno.env.set('ALLOWED_ORIGINS', 'https://portfolio.example');
  Deno.env.set('RESEND_API_KEY', 're_test_only_mocked');
  Deno.env.set('MAIL_FROM', 'Portfolio <test@portfolio.example>');
  Deno.env.set('OWNER_EMAIL', 'owner@example.com');
}

Deno.test('public endpoints reject mismatched origins and non-POST methods', async () => {
  setup();
  let reached = false;
  const handler = async () => { reached = true; return new Response('ok'); };
  const wrong = await handlePublic(new Request('https://backend.example', { headers: { origin: 'https://evil.example' } }), handler);
  assert(wrong.status === 403 && !reached);
  const get = await handlePublic(new Request('https://backend.example', { headers: { origin: 'https://portfolio.example' } }), handler);
  assert(get.status === 405 && !reached);
  const options = await handlePublic(new Request('https://backend.example', { method: 'OPTIONS', headers: { origin: 'https://portfolio.example' } }), handler);
  assert(options.status === 204 && !reached);
  assert(originHeaders(new Request('https://backend.example', { headers: { origin: 'https://portfolio.example' } }))['Access-Control-Allow-Origin'] === 'https://portfolio.example');
});
Deno.test('email uses a fixed server recipient, a stable idempotency key, and a real attachment', async () => {
  setup(); let calls = 0;
  globalThis.fetch = async (input, options) => {
    assert(input === 'https://api.resend.com/emails'); calls++;
    const body = JSON.parse(String(options?.body));
    const headers = options?.headers as Record<string,string>;
    assert(body.to.length === 1 && body.to[0] === 'owner@example.com');
    assert(headers['Idempotency-Key'] === 'visit/test-reference');
    assert(body.attachments[0].content === 'AQID');
    return new Response(JSON.stringify({id:'mock-mail-id'}), {status:200});
  };
  try { const id = await sendMail({id:'test-reference',kind:'visit',subject:'A test',text:'Synthetic test only',attachment:{name:'capture.jpg',bytes:new Uint8Array([1,2,3])}}); assert(id === 'mock-mail-id' && calls === 1); }
  finally { globalThis.fetch = originalFetch; }
});
Deno.test('email rejection or a malformed provider response cannot become success', async () => {
  setup();
  try {
    for (const response of [new Response('{}',{status:500}),new Response('{}',{status:200})]) {
      globalThis.fetch = async () => response;
      let rejected = false; try { await sendMail({id:'test',kind:'visit',subject:'A test',text:'Synthetic'}); } catch { rejected = true; }
      assert(rejected);
    }
  } finally { globalThis.fetch = originalFetch; }
});
Deno.test('Turnstile is verified on the server and must match the intended hostname', async () => {
  setup(); Deno.env.set('REQUIRE_TURNSTILE','true'); Deno.env.set('TURNSTILE_SECRET_KEY','mock-secret'); Deno.env.set('TURNSTILE_HOSTNAMES','portfolio.example');
  const form = new FormData(); form.set('turnstileToken','mock-token');
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({success:true,hostname:'evil.example'}));
    let rejected = false; try { await checkTurnstile(form); } catch { rejected = true; } assert(rejected);
    globalThis.fetch = async () => new Response(JSON.stringify({success:true,hostname:'portfolio.example'}));
    await checkTurnstile(form);
  } finally { globalThis.fetch = originalFetch; }
});
Deno.test('base64 handles attachment-sized buffers without overflowing a call stack', () => {
  const bytes = new Uint8Array(1024 * 1024).fill(123);
  assert(atob(toBase64(bytes)).length === bytes.length);
});
