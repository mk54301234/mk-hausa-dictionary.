import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20261101202450_enforce_publish_permission_on_entry_insert.sql', import.meta.url),
  'utf8'
);
const roleMigration = await readFile(
  new URL('../supabase/migrations/202610260001_staff_permissions.sql', import.meta.url),
  'utf8'
);
const settingsMigration = await readFile(
  new URL('../supabase/migrations/20261101202459_revoke_excess_dictionary_settings_privileges.sql', import.meta.url),
  'utf8'
);

test('non-draft inserts require entries_publish at database level', () => {
  assert.match(migration, /BEFORE INSERT ON public\.dictionary_entries/i);
  assert.match(migration, /NEW\.status IS DISTINCT FROM 'draft'/i);
  assert.match(migration, /current_admin_can\('entries_publish'\)/i);
  assert.match(migration, /USING ERRCODE = '42501'/i);
});

test('draft inserts remain available to create-authorized staff', () => {
  assert.match(migration, /IF NEW\.status IS DISTINCT FROM 'draft'[\s\S]*?entries_publish/i);
  assert.match(roleMigration, /WHEN au\.role = 'editor' THEN p_permission IN \('entries_read','entries_create','entries_edit'\)/i);
});

test('publish permission does not replace the existing create permission', () => {
  assert.match(roleMigration, /WITH CHECK \(\(SELECT public\.current_admin_can\('entries_create'\)\)\)/i);
});

test('service role retains its trusted server-side insert path', () => {
  assert.match(migration, /auth\.role\(\) = 'service_role'/i);
});

test('trigger function is not directly executable by API roles', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.enforce_dictionary_entry_insert_publish_permission\(\)[\s\S]*?FROM PUBLIC, anon, authenticated/i);
});

test('dictionary settings keeps ordinary read/update grants but loses excess privileges', () => {
  assert.match(settingsMigration, /REVOKE TRUNCATE, REFERENCES, TRIGGER[\s\S]*?ON TABLE public\.dictionary_settings[\s\S]*?FROM PUBLIC, anon, authenticated/i);
  assert.doesNotMatch(settingsMigration, /REVOKE\s+SELECT|REVOKE\s+UPDATE/i);
});
