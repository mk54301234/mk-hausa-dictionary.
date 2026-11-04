-- Owner-controlled Home Screen language direction and safe admin invitations.
CREATE TABLE IF NOT EXISTS public.dictionary_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  home_direction text NOT NULL DEFAULT 'ha-en' CHECK (home_direction IN ('ha-en', 'en-ha')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.dictionary_settings (id, home_direction)
VALUES (true, 'ha-en')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.dictionary_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.dictionary_settings TO anon, authenticated;
GRANT UPDATE ON public.dictionary_settings TO authenticated;
DROP POLICY IF EXISTS "Public can read dictionary settings" ON public.dictionary_settings;
CREATE POLICY "Public can read dictionary settings"
ON public.dictionary_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Owners can update dictionary settings" ON public.dictionary_settings;
CREATE POLICY "Owners can update dictionary settings"
ON public.dictionary_settings FOR UPDATE TO authenticated
USING ((SELECT public.current_admin_role()) = 'owner')
WITH CHECK ((SELECT public.current_admin_role()) = 'owner');

CREATE OR REPLACE FUNCTION public.add_dictionary_admin_by_email(p_email text, p_role text DEFAULT 'editor')
RETURNS TABLE(user_id uuid, email text, role text, is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  target_user_id uuid;
  normalized_email text := lower(trim(p_email));
BEGIN
  IF auth.uid() IS NULL OR (SELECT public.current_admin_role()) <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can add admins' USING ERRCODE = '42501';
  END IF;
  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required' USING ERRCODE = '22023';
  END IF;
  IF p_role NOT IN ('admin', 'editor') THEN
    RAISE EXCEPTION 'Role must be admin or editor' USING ERRCODE = '22023';
  END IF;
  SELECT u.id INTO target_user_id FROM auth.users AS u
  WHERE lower(u.email) = normalized_email LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No registered account found for this email. Ask the person to sign in once first.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.admin_users (user_id, email, role, is_active, created_by)
  VALUES (target_user_id, normalized_email, p_role, true, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email, role = EXCLUDED.role, is_active = true, created_by = auth.uid();
  RETURN QUERY SELECT a.user_id, a.email, a.role, a.is_active
  FROM public.admin_users AS a WHERE a.user_id = target_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_dictionary_admin_by_email(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_dictionary_admin_by_email(text, text) TO authenticated;
