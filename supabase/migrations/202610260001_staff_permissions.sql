-- Per-employee permissions for MK Hausa Dictionary.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('owner','admin','editor','reviewer','viewer'));

CREATE OR REPLACE FUNCTION public.current_admin_can(p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN au.role = 'owner' THEN true
      WHEN au.permissions ? p_permission THEN (au.permissions ->> p_permission)::boolean
      WHEN au.role = 'admin' THEN p_permission IN ('entries_read','entries_create','entries_edit','entries_publish','entries_delete','feedback_manage','reports_view')
      WHEN au.role = 'editor' THEN p_permission IN ('entries_read','entries_create','entries_edit')
      WHEN au.role = 'reviewer' THEN p_permission IN ('entries_read','entries_review','feedback_manage')
      WHEN au.role = 'viewer' THEN p_permission IN ('entries_read','reports_view')
      ELSE false
    END
    FROM public.admin_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = true
    LIMIT 1
  ), false);
$$;
REVOKE ALL ON FUNCTION public.current_admin_can(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_admin_can(text) TO authenticated;

-- Use granular permissions in database policies, not just UI visibility.
DROP POLICY IF EXISTS "Admins can view published dictionary entries" ON public.dictionary_entries;
DROP POLICY IF EXISTS "Public can view published dictionary entries" ON public.dictionary_entries;
CREATE POLICY "Public can view published dictionary entries"
ON public.dictionary_entries FOR SELECT TO anon, authenticated
USING (status = 'published' OR (SELECT public.current_admin_can('entries_read')));

DROP POLICY IF EXISTS "Admins can insert dictionary entries" ON public.dictionary_entries;
CREATE POLICY "Authorized staff can insert dictionary entries"
ON public.dictionary_entries FOR INSERT TO authenticated
WITH CHECK ((SELECT public.current_admin_can('entries_create')));

DROP POLICY IF EXISTS "Admins can update dictionary entries" ON public.dictionary_entries;
CREATE POLICY "Authorized staff can update dictionary entries"
ON public.dictionary_entries FOR UPDATE TO authenticated
USING ((SELECT public.current_admin_can('entries_edit')) OR (SELECT public.current_admin_can('entries_publish')))
WITH CHECK ((SELECT public.current_admin_can('entries_edit')) OR (SELECT public.current_admin_can('entries_publish')));

DROP POLICY IF EXISTS "Admins can delete dictionary entries" ON public.dictionary_entries;
CREATE POLICY "Authorized staff can delete dictionary entries"
ON public.dictionary_entries FOR DELETE TO authenticated
USING ((SELECT public.current_admin_can('entries_delete')));

DROP POLICY IF EXISTS "Admins can view feedback" ON public.feedback;
CREATE POLICY "Authorized staff can view feedback"
ON public.feedback FOR SELECT TO authenticated
USING ((SELECT public.current_admin_can('feedback_manage')));

DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Authorized staff can update feedback"
ON public.feedback FOR UPDATE TO authenticated
USING ((SELECT public.current_admin_can('feedback_manage')))
WITH CHECK ((SELECT public.current_admin_can('feedback_manage')));

CREATE OR REPLACE FUNCTION public.set_dictionary_staff_access(
  p_user_id uuid,
  p_role text,
  p_permissions jsonb,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR (SELECT public.current_admin_role()) <> 'owner' THEN
    RAISE EXCEPTION 'Only owner can manage staff access' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin','editor','reviewer','viewer') THEN
    RAISE EXCEPTION 'Invalid staff role' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_permissions, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Permissions must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Owner access cannot be changed through staff management' USING ERRCODE = '42501';
  END IF;
  UPDATE public.admin_users
  SET role = p_role,
      permissions = COALESCE(p_permissions, '{}'::jsonb),
      is_active = p_is_active
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_dictionary_staff_access(uuid,text,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_dictionary_staff_access(uuid,text,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_dictionary_admin_by_email(p_email text, p_role text DEFAULT 'editor')
RETURNS TABLE(user_id uuid, email text, role text, is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE target_user_id uuid; normalized_email text := lower(trim(p_email));
BEGIN
  IF auth.uid() IS NULL OR (SELECT public.current_admin_role()) <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can add staff' USING ERRCODE = '42501';
  END IF;
  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required' USING ERRCODE = '22023';
  END IF;
  IF p_role NOT IN ('admin','editor','reviewer','viewer') THEN
    RAISE EXCEPTION 'Role must be admin, editor, reviewer or viewer' USING ERRCODE = '22023';
  END IF;
  SELECT u.id INTO target_user_id FROM auth.users u
  WHERE lower(u.email) = normalized_email LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No registered account found for this email. Ask the person to sign in once first.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = target_user_id AND a.role = 'owner') THEN
    RAISE EXCEPTION 'Owner cannot be changed into staff' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.admin_users (user_id,email,role,is_active,created_by,permissions)
  VALUES (target_user_id,normalized_email,p_role,true,auth.uid(),'{}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE
  SET email=EXCLUDED.email, role=EXCLUDED.role, is_active=true, created_by=auth.uid();
  RETURN QUERY SELECT a.user_id,a.email,a.role,a.is_active
  FROM public.admin_users a WHERE a.user_id=target_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_dictionary_admin_by_email(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_dictionary_admin_by_email(text,text) TO authenticated;
