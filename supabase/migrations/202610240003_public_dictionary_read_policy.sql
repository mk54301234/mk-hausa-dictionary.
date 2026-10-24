-- Keep published dictionary entries public without exposing the admin role helper to anon.
DROP POLICY IF EXISTS "Admins can view published dictionary entries" ON public.dictionary_entries;
DROP POLICY IF EXISTS "Public can view published dictionary entries" ON public.dictionary_entries;
DROP POLICY IF EXISTS "Admins can view dictionary entries" ON public.dictionary_entries;

CREATE POLICY "Public can view published dictionary entries"
ON public.dictionary_entries FOR SELECT TO anon
USING (status = 'published');

CREATE POLICY "Admins can view dictionary entries"
ON public.dictionary_entries FOR SELECT TO authenticated
USING (
  status = 'published'
  OR (SELECT public.current_admin_role()) IN ('owner', 'admin', 'editor')
);
