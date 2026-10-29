const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function createDeleteEmployeeHandler({ createClient, getEnv }) {
  return async function (request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });

    const authorization = request.headers.get('authorization') || '';
    const token = authorization.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
    if (!token) return response(401, { error: 'Sign in with an authorized owner account.' });

    const supabaseUrl = getEnv('SUPABASE_URL');
    const anonKey = getEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return response(500, { error: 'Employee deletion is not configured on the server.' });

    let payload;
    try { payload = await request.json(); } catch { return response(400, { error: 'A valid JSON request body is required.' }); }
    const targetUserId = payload?.user_id;
    const attemptKey = payload?.attempt_key;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof targetUserId !== 'string' || !uuid.test(targetUserId)) return response(400, { error: 'A valid employee user ID is required.' });
    if (typeof attemptKey !== 'string' || !uuid.test(attemptKey)) return response(400, { error: 'A valid deletion attempt key is required.' });

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userResult, error: authError } = await userClient.auth.getUser(token);
    const actor = userResult?.user;
    if (authError || !actor) return response(401, { error: 'Your sign-in session is invalid or expired.' });
    if (actor.id === targetUserId) return response(400, { error: 'You cannot delete your own account here.' });

    const { data: actorAccess, error: actorAccessError } = await userClient.from('admin_users')
      .select('role, is_active').eq('user_id', actor.id).maybeSingle();
    if (actorAccessError) return response(500, { error: 'Could not verify your employee-management permission.' });
    if (!actorAccess || actorAccess.role !== 'owner' || actorAccess.is_active !== true) return response(403, { error: 'Only an active owner can delete an employee account.' });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: prepared, error: prepareError } = await adminClient.rpc('prepare_dictionary_employee_deletion', {
      p_actor_user_id: actor.id, p_target_user_id: targetUserId, p_attempt_key: attemptKey
    });
    if (prepareError) {
      if (prepareError.code === '42501') return response(403, { error: 'Owner accounts and your own account cannot be deleted.' });
      if (prepareError.code === 'P0002') return response(404, { error: 'The selected employee no longer exists.' });
      if (prepareError.code === '23514') return response(409, { error: 'The last active admin account cannot be deleted, or a database safeguard blocked this action.' });
      if (prepareError.code === 'P0001') return response(409, { error: 'This deletion attempt conflicts with an existing or cancelled request. Start a new attempt only after checking its status.' });
      return response(500, { error: 'Could not safely prepare the employee account for deletion.' });
    }

    const target = Array.isArray(prepared) ? prepared[0] : prepared;
    if (!target) return response(404, { error: 'The selected employee no longer exists.' });

    const completeDeletion = async () => {
      const { error } = await adminClient.rpc('complete_dictionary_employee_deletion', {
        p_actor_user_id: actor.id, p_audit_id: target.audit_id, p_target_user_id: targetUserId, p_attempt_key: attemptKey
      });
      return error;
    };
    const cancelDeletion = async () => {
      const { error } = await adminClient.rpc('cancel_dictionary_employee_deletion', {
        p_actor_user_id: actor.id, p_audit_id: target.audit_id, p_target_user_id: targetUserId, p_attempt_key: attemptKey
      });
      return error;
    };
    const lookupAuthAccount = async () => {
      try {
        const result = await adminClient.auth.admin.getUserById(targetUserId);
        if (result.error) return result.error.status === 404 || result.error.code === 'user_not_found' ? 'absent' : 'unknown';
        return result.data?.user ? 'present' : 'unknown';
      } catch { return 'unknown'; }
    };

    if (target.deletion_status === 'completed') {
      const state = await lookupAuthAccount();
      if (state === 'absent') return response(200, { deleted: true, attempt_key: attemptKey, reconciliation: 'completed' });
      return response(500, { status: 'completed', deleted: false, attempt_key: attemptKey, error: 'Completed audit and current Auth state do not agree; manual review is required.' });
    }

    let authState = await lookupAuthAccount();
    if (authState === 'absent') {
      const auditError = await completeDeletion();
      if (auditError) return response(500, { status: 'pending', deleted: true, attempt_key: attemptKey, error: 'The Auth account is deleted, but audit completion is pending. Retry using the same attempt key.' });
      return response(200, { deleted: true, attempt_key: attemptKey, reconciliation: 'completed' });
    }
    if (authState === 'unknown') return response(202, { status: 'pending', deleted: false, attempt_key: attemptKey, error: 'Auth account state could not be confirmed. Retry with the same attempt key.' });

    let deleteThrown = false;
    try {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (deleteError) authState = await lookupAuthAccount();
      else authState = 'absent';
    } catch {
      deleteThrown = true;
      authState = await lookupAuthAccount();
    }
    if (authState === 'unknown') return response(202, { status: 'pending', deleted: false, attempt_key: attemptKey, error: 'The deletion result is uncertain. Retry with the same attempt key.' });
    if (authState === 'present') {
      const cancelError = await cancelDeletion();
      if (cancelError) return response(500, { status: 'pending', deleted: false, attempt_key: attemptKey, error: 'Deletion did not occur, but cancellation and access restoration failed. Retry with the same attempt key or review the audit.' });
      return response(500, { status: 'cancelled', deleted: false, attempt_key: attemptKey, error: deleteThrown ? 'Deletion could not be confirmed; access was restored.' : 'Supabase Auth could not delete the account; its prior access was restored.' });
    }

    const auditError = await completeDeletion();
    if (auditError) return response(500, { status: 'pending', deleted: true, attempt_key: attemptKey, error: 'The Auth account was deleted, but audit completion is pending. Retry with the same attempt key.' });
    return response(200, { deleted: true, attempt_key: attemptKey, reconciliation: 'completed' });
  };
}
