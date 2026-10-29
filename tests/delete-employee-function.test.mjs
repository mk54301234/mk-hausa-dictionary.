import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeleteEmployeeHandler } from '../supabase/functions/delete-dictionary-employee/handler.mjs';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
};

function request(method, headers = {}, body) {
  return new Request('https://local.test/functions/v1/delete-dictionary-employee', {
    method,
    headers,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
  });
}

test('OPTIONS responds 204 with CORS headers', async () => {
  const handler = createDeleteEmployeeHandler({ createClient() { throw new Error('must not create a client'); }, getEnv: () => '' });
  const response = await handler(request('OPTIONS'));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
});

test('non-POST method is rejected', async () => {
  const handler = createDeleteEmployeeHandler({ createClient() { throw new Error('must not create a client'); }, getEnv: () => '' });
  const response = await handler(request('GET'));
  assert.equal(response.status, 405);
});

test('missing or malformed Bearer authorization is rejected before client creation', async (t) => {
  for (const authorization of ['', 'Basic token', 'Bearer', 'Bearer token extra']) {
    await t.test(authorization || '(missing)', async () => {
      const handler = createDeleteEmployeeHandler({ createClient() { throw new Error('must not create a client'); }, getEnv: (name) => env[name] });
      const response = await handler(request('POST', authorization ? { authorization } : {} , { user_id: '00000000-0000-4000-8000-000000000001', attempt_key: '00000000-0000-4000-8000-000000000002' }));
      assert.equal(response.status, 401);
    });
  }
});

test('a single Bearer token is parsed and checked with Supabase Auth', async () => {
  let created = [];
  const handler = createDeleteEmployeeHandler({
    getEnv: (name) => env[name],
    createClient(url, key, options) {
      created.push({ url, key, options });
      return { auth: { getUser: async (token) => ({ data: { user: null }, error: { message: 'invalid token' } }) } };
    }
  });
  const response = await handler(request('POST', { authorization: 'Bearer example-token' }, {
    user_id: '00000000-0000-4000-8000-000000000001',
    attempt_key: '00000000-0000-4000-8000-000000000002'
  }));
  assert.equal(response.status, 401);
  assert.equal(created.length, 1);
  assert.equal(created[0].options.global.headers.Authorization, 'Bearer example-token');
});

test('missing server configuration fails closed', async () => {
  const handler = createDeleteEmployeeHandler({ createClient() { throw new Error('must not create a client'); }, getEnv: () => undefined });
  const response = await handler(request('POST', { authorization: 'Bearer example-token' }, {
    user_id: '00000000-0000-4000-8000-000000000001',
    attempt_key: '00000000-0000-4000-8000-000000000002'
  }));
  assert.equal(response.status, 500);
});

test('invalid JSON and invalid UUID inputs are rejected without admin actions', async (t) => {
  const handler = createDeleteEmployeeHandler({ createClient() { throw new Error('must not create a client'); }, getEnv: (name) => env[name] });
  const auth = { authorization: 'Bearer example-token' };
  const invalidJson = await handler(request('POST', { ...auth, 'content-type': 'application/json' }, '{'));
  assert.equal(invalidJson.status, 400);
  const invalidId = await handler(request('POST', auth, { user_id: 'not-a-uuid', attempt_key: '00000000-0000-4000-8000-000000000002' }));
  assert.equal(invalidId.status, 400);
  const invalidAttempt = await handler(request('POST', auth, { user_id: '00000000-0000-4000-8000-000000000001', attempt_key: 'not-a-uuid' }));
  assert.equal(invalidAttempt.status, 400);
});
