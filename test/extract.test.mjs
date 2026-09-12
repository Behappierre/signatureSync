import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { extractSignature } from '../src/lib/extract.ts';

const SIGNATURE = `Jane Smith
Example Rail Ltd
jane.smith@examplerail.com
+44 7700 900321`;

const realFetch = globalThis.fetch;
let calls = [];

function stubFetch(status, body) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('the AI pass fills fields the parser could not find', async () => {
  stubFetch(200, { fields: { title: 'Head of Operations' }, confidence: 0.9 });

  const result = await extractSignature(SIGNATURE, { accessToken: 'token' });

  assert.equal(result.contact.title, 'Head of Operations');
  assert.equal(result.origin.title, 'ai');
  assert.equal(result.source, 'hybrid');
  assert.equal(calls.length, 1);
});

test('an email the model invented is rejected', async () => {
  stubFetch(200, { fields: { email: 'someone.else@wrongdomain.com' }, confidence: 0.95 });

  const result = await extractSignature(SIGNATURE, { accessToken: 'token' });

  assert.equal(result.contact.email, 'jane.smith@examplerail.com');
});

test('a phone number absent from the source is rejected', async () => {
  stubFetch(200, { fields: { phone: '+44 20 1111 2222' }, confidence: 0.95 });

  const result = await extractSignature(SIGNATURE, { accessToken: 'token' });

  assert.equal(result.contact.phone, '+44 7700 900321');
});

test('a phone number formatted differently by the model is still accepted', async () => {
  stubFetch(200, { fields: { phone: '+447700900321' }, confidence: 0.95 });

  const result = await extractSignature('Jane Smith\nTel 07700 900321\njane@examplerail.com', {
    accessToken: 'token',
  });

  assert.equal(result.contact.phone, '+447700900321');
});

test('the parser keeps ownership of the email even when the model agrees differently', async () => {
  stubFetch(200, { fields: { email: 'JANE.SMITH@examplerail.com' }, confidence: 0.99 });

  const result = await extractSignature(SIGNATURE, { accessToken: 'token' });

  assert.equal(result.contact.email, 'jane.smith@examplerail.com');
  assert.equal(result.origin.email, 'heuristic');
});

test('offline mode makes no network call at all', async () => {
  stubFetch(200, { fields: { title: 'Should not be used' } });

  const result = await extractSignature(SIGNATURE, { accessToken: 'token', offlineOnly: true });

  assert.equal(calls.length, 0);
  assert.equal(result.source, 'heuristic');
  assert.equal(result.contact.email, 'jane.smith@examplerail.com');
});

test('an unconfigured model endpoint degrades to parsing with a warning', async () => {
  stubFetch(501, { error: 'No model API key is configured on this deployment.' });

  const result = await extractSignature(SIGNATURE, { accessToken: 'token' });

  assert.equal(result.source, 'heuristic');
  assert.equal(result.contact.email, 'jane.smith@examplerail.com');
  assert.match(result.warnings[0], /No AI model is configured/);
});

test('a network failure degrades to parsing rather than throwing', async () => {
  globalThis.fetch = async () => {
    throw new Error('offline');
  };

  const result = await extractSignature(SIGNATURE, { accessToken: 'token' });

  assert.equal(result.contact.email, 'jane.smith@examplerail.com');
  assert.match(result.warnings[0], /Could not reach/);
});

test('without a Google token no request is sent and the user is told why', async () => {
  stubFetch(200, { fields: {} });

  const result = await extractSignature(SIGNATURE, { accessToken: null });

  assert.equal(calls.length, 0);
  assert.match(result.warnings[0], /Connect Google/);
});

test('the request carries the Google token as a bearer credential', async () => {
  stubFetch(200, { fields: {} });

  await extractSignature(SIGNATURE, { accessToken: 'abc123' });

  assert.equal(calls[0].url, '/api/extract');
  assert.equal(calls[0].init.headers.authorization, 'Bearer abc123');
});

test('confidence is never left on a field the model blanked out', async () => {
  stubFetch(200, { fields: { company: '' }, confidence: 0.9 });

  const result = await extractSignature(SIGNATURE, { accessToken: 'token' });

  for (const [field, score] of Object.entries(result.confidence)) {
    assert.ok(result.contact[field], `confidence ${score} left on empty field ${field}`);
  }
});
