create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.dictionary_entry_activity (
  id bigint generated always as identity primary key,
  entry_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null check (action in ('created','updated','deleted')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dictionary_entry_activity_created_at_idx
  on public.dictionary_entry_activity (created_at desc);
create index if not exists dictionary_entry_activity_actor_created_at_idx
  on public.dictionary_entry_activity (actor_user_id, created_at desc);
create index if not exists dictionary_entry_activity_entry_id_idx
  on public.dictionary_entry_activity (entry_id);

alter table public.dictionary_entry_activity enable row level security;
revoke all on public.dictionary_entry_activity from anon, authenticated;
grant select on public.dictionary_entry_activity to authenticated;

drop policy if exists "Only owners can view dictionary activity" on public.dictionary_entry_activity;
create policy "Only owners can view dictionary activity"
  on public.dictionary_entry_activity
  for select to authenticated
  using ((select public.current_admin_role()) = 'owner');

create or replace function private.capture_dictionary_entry_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_old jsonb;
  v_new jsonb;
  v_entry_id uuid;
  v_action text;
begin
  if v_actor is not null then
    select u.email into v_email from auth.users u where u.id = v_actor;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'created';
    v_new := to_jsonb(new);
    v_entry_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_action := 'updated';
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_entry_id := new.id;
    if v_old is not distinct from v_new then
      return new;
    end if;
  else
    v_action := 'deleted';
    v_old := to_jsonb(old);
    v_entry_id := old.id;
  end if;

  insert into public.dictionary_entry_activity
    (entry_id, actor_user_id, actor_email, action, old_data, new_data)
  values
    (v_entry_id, v_actor, v_email, v_action, v_old, v_new);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.capture_dictionary_entry_activity() from public, anon, authenticated;

drop trigger if exists dictionary_entry_activity_audit on public.dictionary_entries;
create trigger dictionary_entry_activity_audit
  after insert or update or delete on public.dictionary_entries
  for each row execute function private.capture_dictionary_entry_activity();


-- Fix ambiguous output-column references in the owner-only admin grant RPC.
create or replace function public.add_dictionary_admin_by_email(p_email text, p_role text default 'editor')
returns table(user_id uuid, email text, role text, is_active boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  target_user_id uuid;
  normalized_email text := lower(trim(p_email));
begin
  if auth.uid() is null or (select public.current_admin_role()) <> 'owner' then
    raise exception 'Only the owner can add admins' using errcode = '42501';
  end if;
  if normalized_email is null or normalized_email = '' then
    raise exception 'Email is required' using errcode = '22023';
  end if;
  if p_role not in ('admin','editor') then
    raise exception 'Role must be admin or editor' using errcode = '22023';
  end if;
  select u.id into target_user_id
  from auth.users as u
  where lower(u.email) = normalized_email
  limit 1;
  if target_user_id is null then
    raise exception 'No registered account found for this email. Ask the person to sign in once first.' using errcode = 'P0002';
  end if;
  insert into public.admin_users as existing_admin (user_id,email,role,is_active,created_by)
  values (target_user_id,normalized_email,p_role,true,auth.uid())
  on conflict on constraint admin_users_pkey
  do update set email=excluded.email, role=excluded.role, is_active=true, created_by=auth.uid();
  return query
  select a.user_id, a.email, a.role, a.is_active
  from public.admin_users as a
  where a.user_id = target_user_id;
end;
$function$;
