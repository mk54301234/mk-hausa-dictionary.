-- MK Hausa Dictionary: optional related words for each dictionary entry.
-- Safe to run more than once; existing entries remain unchanged.
ALTER TABLE public.dictionary_entries
  ADD COLUMN IF NOT EXISTS related_words text[] NOT NULL DEFAULT '{}'::text[];
