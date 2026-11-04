REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLE
  public.admin_users,
  public.dictionary_entries,
  public.feedback,
  public.admin_user_activity,
  public.dictionary_entry_activity
FROM PUBLIC, anon, authenticated;
