-- Enforce publication authorization for newly inserted dictionary entries.
-- INSERT RLS continues to require entries_create. This trigger adds the
-- independent entries_publish requirement for every non-draft status.
CREATE OR REPLACE FUNCTION private.enforce_dictionary_entry_insert_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  -- Trusted server-side operations bypass staff permission checks.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'draft'
     AND NOT public.current_admin_can('entries_publish') THEN
    RAISE EXCEPTION 'entries_publish permission is required to create a non-draft dictionary entry'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger functions are invoked by PostgreSQL triggers; clients must not
-- be able to call this function directly as an RPC.
REVOKE ALL ON FUNCTION private.enforce_dictionary_entry_insert_publish_permission()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_dictionary_entry_insert_publish_permission
ON public.dictionary_entries;

CREATE TRIGGER enforce_dictionary_entry_insert_publish_permission
BEFORE INSERT ON public.dictionary_entries
FOR EACH ROW
EXECUTE FUNCTION private.enforce_dictionary_entry_insert_publish_permission();
