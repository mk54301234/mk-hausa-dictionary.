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


const ACTOR_ID = '00000000-0000-4000-8000-000000000010';
const TARGET_ID = '00000000-0000-4000-8000-000000000011';
const ATTEMPT_KEY = '00000000-0000-4000-8000-000000000012';
const AUDIT_ID = '00000000-0000-4000-8000-000000000013';

function authorizedHarness({
  role = 'owner',
  active = true,
  authState = 'present',
  deleteError = null,
  prepareError = null,
  deletionStatus = 'prepared',
  completeError = null,
  cancelError = null
} = {}) {
  const calls = { clients: [], rpc: [], deleteUser: 0 };
  let state = authState;
  const createClient = (url, key, options) => {
    calls.clients.push({ key, options });
    if (key === env.SUPABASE_ANON_KEY) {
      return {
        auth: { getUser: async token => ({
          data: { user: { id: ACTOR_ID } }, error: null
        }) },
        from: table => ({
          select: columns => ({
            eq: (column, value) => ({
              maybeSingle: async () => ({
                data: table === 'admin_users' && column === 'user_id' && value === ACTOR_ID
                  ? { role, is_active: active } : null,
                error: null
              })
            })
          })
        })
      };
    }
    return {
      rpc: async (name, args) => {
        calls.rpc.push({ name, args });
        if (name === 'prepare_dictionary_employee_deletion') {
          return prepareError
            ? { data: null, error: prepareError }
            : { data: { audit_id: AUDIT_ID, deletion_status: deletionStatus }, error: null };
        }
        if (name === 'complete_dictionary_employee_deletion') return { error: completeError };
        if (name === 'cancel_dictionary_employee_deletion') return { error: cancelError };
        throw new Error('Unexpected RPC: ' + name);
      },
      auth: {
        admin: {
          getUserById: async id => {
            if (id !== TARGET_ID) throw new Error('Unexpected target ID');
            if (state === 'unknown') return { data: null, error: { status: 503 } };
            if (state === 'absent') return { data: { user: null }, error: { status: 404, code: 'user_not_found' } };
            return { data: { user: { id: TARGET_ID } }, error: null };
          },
          deleteUser: async id => {
            calls.deleteUser++;
            if (id !== TARGET_ID) throw new Error('Unexpected target ID');
            if (!deleteError) state = 'absent';
            return { error: deleteError };
          }
        }
      }
    };
  };
  return {
    calls,
    handler: createDeleteEmployeeHandler({ createClient, getEnv: name => env[name] })
  };
}

test('inactive or non-owner account is denied before service-role client creation', async () => {
  for (const options of [{ role: 'editor' }, { active: false }]) {
    const harness = authorizedHarness(options);
    const response = await harness.handler(request('POST', { authorization: 'Bearer valid-test-token' }, {
      user_id: TARGET_ID, attempt_key: ATTEMPT_KEY
    }));
    assert.equal(response.status, 403);
    assert.equal(harness.calls.clients.length, 1);
    assert.equal(harness.calls.deleteUser, 0);
  }
});

test('owner cannot delete their own account', async () => {
  const harness = authorizedHarness();
  const response = await harness.handler(request('POST', { authorization: 'Bearer valid-test-token' }, {
    user_id: ACTOR_ID, attempt_key: ATTEMPT_KEY
  }));
  assert.equal(response.status, 400);
  assert.equal(harness.calls.clients.length, 1);
  assert.equal(harness.calls.deleteUser, 0);
});

test('prepare safeguard errors stop before Auth deletion', async () => {
  const harness = authorizedHarness({ prepareError: { code: '23514' } });
  const response = await harness.handler(request('POST', { authorization: 'Bearer valid-test-token' }, {
    user_id: TARGET_ID, attempt_key: ATTEMPT_KEY
  }));
  assert.equal(response.status, 409);
  assert.equal(harness.calls.deleteUser, 0);
});

test('uncertain Auth lookup remains pending and does not delete', async () => {
  const harness = authorizedHarness({ authState: 'unknown' });
  const response = await harness.handler(request('POST', { authorization: 'Bearer valid-test-token' }, {
    user_id: TARGET_ID, attempt_key: ATTEMPT_KEY
  }));
  assert.equal(response.status, 202);
  assert.equal(harness.calls.deleteUser, 0);
});

test('successful Auth deletion completes the audit with the same attempt key', async () => {
  const harness = authorizedHarness();
  const response = await harness.handler(request('POST', { authorization: 'Bearer valid-test-token' }, {
    user_id: TARGET_ID, attempt_key: ATTEMPT_KEY
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.deleted, true);
  assert.equal(body.reconciliation, 'completed');
  assert.equal(harness.calls.deleteUser, 1);
  assert.deepEqual(harness.calls.rpc.map(call => call.name), [
    'prepare_dictionary_employee_deletion',
    'complete_dictionary_employee_deletion'
  ]);
  assert.equal(harness.calls.rpc[0].args.p_attempt_key, ATTEMPT_KEY);
  assert.equal(harness.calls.rpc[1].args.p_attempt_key, ATTEMPT_KEY);
});

test('failed Auth deletion cancels the prepared operation and restores access', async () => {
  const harness = authorizedHarness({ deleteError: { message: 'simulated failure' } });
  const response = await harness.handler(request('POST', { authorization: 'Bearer valid-test-token' }, {
    user_id: TARGET_ID, attempt_key: ATTEMPT_KEY
  }));
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.status, 'cancelled');
  assert.equal(body.deleted, false);
  assert.deepEqual(harness.calls.rpc.map(call => call.name), [
    'prepare_dictionary_employee_deletion',
    'cancel_dictionary_employee_deletion'
  ]);
});

test('already absent Auth account is reconciled without a second delete call', async () => {
  const harness = authorizedHarness({ authState: 'absent' });
  const response = await harness.handler(request('POST', { authorization: 'Bearer valid-test-token' }, {
    user_id: TARGET_ID, attempt_key: ATTEMPT_KEY
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.deleted, true);
  assert.equal(body.reconciliation, 'completed');
  assert.equal(harness.calls.deleteUser, 0);
  assert.equal(harness.calls.rpc.at(-1).name, 'complete_dictionary_employee_deletion');
});
