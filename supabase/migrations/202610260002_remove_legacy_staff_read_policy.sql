-- Remove legacy permissive SELECT policy so granular permission checks are authoritative.
DROP POLICY IF EXISTS "Admins can view dictionary entries" ON public.dictionary_entries;
DROP POLICY IF EXISTS "Admins can view published dictionary entries" ON public.dictionary_entries;

-- Ensure only published words are public; staff access follows current_admin_can().
DROP POLICY IF EXISTS "Public can view published dictionary entries" ON public.dictionary_entries;
CREATE POLICY "Public can view published dictionary entries"
ON public.dictionary_entries FOR SELECT TO anon, authenticated
USING (status = 'published' OR (SELECT public.current_admin_can('entries_read')));

-- Keep the public dictionary policy consistent and avoid legacy role-based bypasses.
DROP POLICY IF EXISTS "Admins can view feedback" ON public.feedback;
