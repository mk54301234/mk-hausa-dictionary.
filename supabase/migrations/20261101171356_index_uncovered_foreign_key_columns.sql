CREATE INDEX IF NOT EXISTS admin_user_activity_actor_user_id_idx
  ON public.admin_user_activity (actor_user_id);
CREATE INDEX IF NOT EXISTS admin_users_created_by_idx
  ON public.admin_users (created_by);
CREATE INDEX IF NOT EXISTS dictionary_entries_created_by_idx
  ON public.dictionary_entries (created_by);
CREATE INDEX IF NOT EXISTS dictionary_entries_updated_by_idx
  ON public.dictionary_entries (updated_by);
CREATE INDEX IF NOT EXISTS dictionary_settings_updated_by_idx
  ON public.dictionary_settings (updated_by);
CREATE INDEX IF NOT EXISTS feedback_reviewed_by_idx
  ON public.feedback (reviewed_by);
