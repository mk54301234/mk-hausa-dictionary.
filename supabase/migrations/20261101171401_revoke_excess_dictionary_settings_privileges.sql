-- RLS does not protect TRUNCATE, REFERENCES, or TRIGGER privileges.
-- Keep public SELECT and owner-controlled UPDATE; remove unrelated privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.dictionary_settings
FROM PUBLIC, anon, authenticated;
