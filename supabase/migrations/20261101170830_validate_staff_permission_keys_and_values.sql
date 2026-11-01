CREATE OR REPLACE FUNCTION public.set_dictionary_staff_access(
  p_user_id uuid,
  p_role text,
  p_permissions jsonb,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  permission_key text;
  permission_value jsonb;
BEGIN
  IF auth.uid() IS NULL OR (SELECT public.current_admin_role()) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only owner can manage staff access' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'A staff member and active status are required' USING ERRCODE = '22023';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('admin', 'editor', 'reviewer', 'viewer') THEN
    RAISE EXCEPTION 'Invalid staff role' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(COALESCE(p_permissions, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Permissions must be a JSON object' USING ERRCODE = '22023';
  END IF;

  FOR permission_key, permission_value IN
    SELECT key, value FROM jsonb_each(COALESCE(p_permissions, '{}'::jsonb))
  LOOP
    IF permission_key NOT IN (
      'entries_read',
      'entries_create',
      'entries_edit',
      'entries_publish',
      'entries_delete',
      'entries_review',
      'feedback_manage',
      'reports_view'
    ) THEN
      RAISE EXCEPTION 'Unknown staff permission: %', permission_key
        USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(permission_value) <> 'boolean' THEN
      RAISE EXCEPTION 'Staff permission values must be booleans'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.admin_users AS staff
    WHERE staff.user_id = p_user_id AND staff.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Owner access cannot be changed through staff management'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.admin_users AS staff
  SET role = p_role,
      permissions = COALESCE(p_permissions, '{}'::jsonb),
      is_active = p_is_active
  WHERE staff.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;
