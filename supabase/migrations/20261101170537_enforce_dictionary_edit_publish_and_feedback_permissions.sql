CREATE OR REPLACE FUNCTION private.enforce_dictionary_entry_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  content_changed boolean;
  status_changed boolean;
  can_edit boolean;
  can_publish boolean;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Entry identity and creation metadata are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF auth.role() = 'service_role' THEN
    NEW.updated_by := auth.uid();
    NEW.updated_at := pg_catalog.clock_timestamp();
    RETURN NEW;
  END IF;

  content_changed :=
    (pg_catalog.to_jsonb(NEW) - ARRAY['status', 'updated_at', 'updated_by'])
    IS DISTINCT FROM
    (pg_catalog.to_jsonb(OLD) - ARRAY['status', 'updated_at', 'updated_by']);

  status_changed := NEW.status IS DISTINCT FROM OLD.status;
  can_edit := public.current_admin_can('entries_edit');
  can_publish := public.current_admin_can('entries_publish');

  IF content_changed AND NOT can_edit THEN
    RAISE EXCEPTION 'entries_edit permission is required to change dictionary content'
      USING ERRCODE = '42501';
  END IF;

  IF status_changed AND NOT can_publish THEN
    RAISE EXCEPTION 'entries_publish permission is required to change publication status'
      USING ERRCODE = '42501';
  END IF;

  NEW.updated_by := auth.uid();
  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_dictionary_entry_permissions
ON public.dictionary_entries;

CREATE TRIGGER enforce_dictionary_entry_permissions
BEFORE UPDATE ON public.dictionary_entries
FOR EACH ROW
EXECUTE FUNCTION private.enforce_dictionary_entry_permissions();

CREATE OR REPLACE FUNCTION private.force_new_feedback_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.status := 'new';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS force_new_feedback_submission
ON public.feedback;

CREATE TRIGGER force_new_feedback_submission
BEFORE INSERT ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION private.force_new_feedback_submission();
