REVOKE SELECT, INSERT, UPDATE, DELETE
ON TABLE
  public.dictionary_entries_special_letters_backup_20261025,
  public.lexicon_import_staging
FROM PUBLIC, anon, authenticated;
