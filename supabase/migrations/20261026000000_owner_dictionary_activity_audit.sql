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
