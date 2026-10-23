-- MK HAUSA DICTIONARY: initial admin + dictionary schema
-- Apply this migration in the Supabase SQL Editor or through Supabase CLI.
-- Do not put service-role keys in browser code.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.dictionary_entries (
  id uuid primary key default gen_random_uuid(),
  hausa_word text not null,
  english_translation text not null,
  hausa_meaning text,
  english_meaning text,
  part_of_speech text,
  hausa_pronunciation_url text,
  english_pronunciation_url text,
  examples jsonb not null default '[]'::jsonb,
  related_words text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dictionary_examples_array check (jsonb_typeof(examples) = 'array'),
  constraint dictionary_hausa_word_not_blank check (length(trim(hausa_word)) > 0),
  constraint dictionary_english_translation_not_blank check (length(trim(english_translation)) > 0)
);

create index if not exists dictionary_entries_hausa_word_idx
  on public.dictionary_entries (lower(hausa_word));
create index if not exists dictionary_entries_english_translation_idx
  on public.dictionary_entries (lower(english_translation));
create index if not exists dictionary_entries_status_idx
  on public.dictionary_entries (status);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('translation_error', 'pronunciation', 'suggestion', 'other')),
  word text,
  message text not null,
  contact_email text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

-- SECURITY DEFINER is limited to reading the current user's admin role.
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select au.role
  from public.admin_users as au
  where au.user_id = (select auth.uid())
    and au.is_active = true
  limit 1;
$$;

revoke all on function public.current_admin_role() from public;
grant execute on function public.current_admin_role() to authenticated;

alter table public.admin_users enable row level security;
alter table public.dictionary_entries enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "Admins can view published dictionary entries" on public.dictionary_entries;
create policy "Admins can view published dictionary entries"
  on public.dictionary_entries for select
  to anon, authenticated
  using (
    status = 'published'
    or (select public.current_admin_role()) in ('owner', 'admin', 'editor')
  );

drop policy if exists "Admins can insert dictionary entries" on public.dictionary_entries;
create policy "Admins can insert dictionary entries"
  on public.dictionary_entries for insert
  to authenticated
  with check (
    (select public.current_admin_role()) in ('owner', 'admin', 'editor')
  );

drop policy if exists "Admins can update dictionary entries" on public.dictionary_entries;
create policy "Admins can update dictionary entries"
  on public.dictionary_entries for update
  to authenticated
  using ((select public.current_admin_role()) in ('owner', 'admin', 'editor'))
  with check ((select public.current_admin_role()) in ('owner', 'admin', 'editor'));

drop policy if exists "Admins can delete dictionary entries" on public.dictionary_entries;
create policy "Admins can delete dictionary entries"
  on public.dictionary_entries for delete
  to authenticated
  using ((select public.current_admin_role()) in ('owner', 'admin', 'editor'));

drop policy if exists "Users can view their own admin row; owners can view all" on public.admin_users;
create policy "Users can view their own admin row; owners can view all"
  on public.admin_users for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_admin_role()) = 'owner'
  );

drop policy if exists "Only owners can add admins" on public.admin_users;
create policy "Only owners can add admins"
  on public.admin_users for insert
  to authenticated
  with check ((select public.current_admin_role()) = 'owner');

drop policy if exists "Only owners can update admin access" on public.admin_users;
create policy "Only owners can update admin access"
  on public.admin_users for update
  to authenticated
  using ((select public.current_admin_role()) = 'owner')
  with check ((select public.current_admin_role()) = 'owner');

drop policy if exists "Only owners can remove admin access" on public.admin_users;
create policy "Only owners can remove admin access"
  on public.admin_users for delete
  to authenticated
  using ((select public.current_admin_role()) = 'owner');

-- Feedback is publicly submittable; only admins may read and manage it.
drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Anyone can submit feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (
    length(trim(message)) between 1 and 5000
    and (contact_email is null or length(contact_email) <= 320)
  );

drop policy if exists "Admins can view feedback" on public.feedback;
create policy "Admins can view feedback"
  on public.feedback for select
  to authenticated
  using ((select public.current_admin_role()) in ('owner', 'admin', 'editor'));

drop policy if exists "Admins can update feedback" on public.feedback;
create policy "Admins can update feedback"
  on public.feedback for update
  to authenticated
  using ((select public.current_admin_role()) in ('owner', 'admin', 'editor'))
  with check ((select public.current_admin_role()) in ('owner', 'admin', 'editor'));

-- Bootstrap the first Owner only after that Google account has signed in once:
-- 1. Enable Google provider in Supabase Auth.
-- 2. Sign in with the intended Owner Google account at the configured app URL.
-- 3. In Supabase SQL Editor, run the following after replacing the email if needed:
--
-- insert into public.admin_users (user_id, email, role, is_active)
-- select id, lower(email), 'owner', true
-- from auth.users
-- where lower(email) = lower('mubarakisyaku2024@gmail.com')
-- on conflict (user_id) do update
-- set email = excluded.email, role = 'owner', is_active = true;
--
-- Verify the matched account before running the bootstrap query.
-- Never allow public signup or browser code to assign the owner role.
