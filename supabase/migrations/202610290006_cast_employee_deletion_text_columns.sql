-- Allow an active owner to delete any non-owner employee account,
-- including the last active admin. Preserve the owner-only boundary on retries.
CREATE OR REPLACE FUNCTION public.prepare_dictionary_employee_deletion(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_attempt_key text
)
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  is_active boolean,
  owned_entries bigint,
  audit_id bigint,
  deletion_status text,
  attempt_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  target public.admin_users%ROWTYPE;
  prior public.admin_user_activity%ROWTYPE;
  auditid bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(271828,314159);

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'Actor mismatch' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = p_actor_user_id AND a.role = 'owner' AND a.is_active
  ) THEN
    RAISE EXCEPTION 'Only an active owner can delete an employee account' USING ERRCODE='42501';
  END IF;

  IF p_actor_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'You cannot delete your own account' USING ERRCODE='42501';
  END IF;

  IF p_attempt_key IS NULL OR p_attempt_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'A valid deletion attempt key is required' USING ERRCODE='22023';
  END IF;

  -- Always validate the target's current role before replaying a pending
  -- request so that a target promoted to owner can never be deleted on retry.
  SELECT a.* INTO target
  FROM public.admin_users a
  WHERE a.user_id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected employee no longer exists' USING ERRCODE='P0002';
  END IF;

  IF target.role = 'owner' THEN
    RAISE EXCEPTION 'Owner accounts cannot be deleted' USING ERRCODE='42501';
  END IF;

  SELECT a.* INTO prior
  FROM public.admin_user_activity a
  WHERE a.target_user_id = p_target_user_id
    AND (a.attempt_key = p_attempt_key OR a.deletion_status = 'pending')
  ORDER BY (a.attempt_key = p_attempt_key) DESC, a.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF prior.actor_user_id IS DISTINCT FROM p_actor_user_id
       OR (prior.attempt_key IS NOT NULL AND prior.attempt_key IS DISTINCT FROM p_attempt_key) THEN
      RAISE EXCEPTION 'Deletion attempt belongs to another request' USING ERRCODE='P0001';
    END IF;

    IF prior.deletion_status = 'cancelled' THEN
      RAISE EXCEPTION 'Deletion attempt was cancelled' USING ERRCODE='P0001';
    END IF;

    IF prior.attempt_key IS NULL THEN
      UPDATE public.admin_user_activity SET attempt_key = p_attempt_key WHERE id = prior.id;
    END IF;

    RETURN QUERY
    SELECT p_target_user_id,
      COALESCE((SELECT u.email FROM auth.users u WHERE u.id = p_target_user_id), '')::text,
      COALESCE(prior.old_role, 'unknown')::text,
      COALESCE(prior.old_is_active, false),
      (SELECT count(*) FROM public.dictionary_entries d WHERE d.created_by = p_target_user_id),
      prior.id,
      prior.deletion_status,
      p_attempt_key;
    RETURN;
  END IF;

  -- Intentionally no last-active-admin restriction: only owner accounts are
  -- protected, and only an active owner may initiate this workflow.
  UPDATE public.admin_users AS au
  SET is_active = false
  WHERE au.user_id = target.user_id AND au.is_active = true;

  INSERT INTO public.admin_user_activity(
    actor_user_id, target_user_id, action, old_role, old_is_active, deletion_status, attempt_key
  )
  VALUES (
    p_actor_user_id, target.user_id, 'removed', target.role, target.is_active, 'pending', p_attempt_key
  )
  RETURNING id INTO auditid;

  RETURN QUERY
  SELECT target.user_id,
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = target.user_id), target.email)::text,
    target.role::text,
    target.is_active,
    (SELECT count(*) FROM public.dictionary_entries d WHERE d.created_by = target.user_id),
    auditid,
    'pending'::text,
    p_attempt_key;
END
$function$;
