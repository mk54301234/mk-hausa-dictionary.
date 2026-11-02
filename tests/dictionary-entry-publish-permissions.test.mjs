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
const updateMigration = await readFile(
  new URL('../supabase/migrations/20261101170537_enforce_dictionary_edit_publish_and_feedback_permissions.sql', import.meta.url),
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

test('role defaults and explicit permission overrides preserve the publish boundary', () => {
  assert.match(roleMigration, /WHEN au\.role = 'owner' THEN true/i);
  assert.match(roleMigration, /WHEN au\.permissions \? p_permission THEN \(au\.permissions ->> p_permission\)::boolean/i);
  assert.match(roleMigration, /WHEN au\.role = 'admin' THEN p_permission IN \('entries_read','entries_create','entries_edit','entries_publish','entries_delete','feedback_manage','reports_view'\)/i);
  assert.match(roleMigration, /WHEN au\.role = 'editor' THEN p_permission IN \('entries_read','entries_create','entries_edit'\)/i);
  assert.match(roleMigration, /WHEN au\.role = 'reviewer' THEN p_permission IN \('entries_read','entries_review','feedback_manage'\)/i);
  assert.match(roleMigration, /WHEN au\.role = 'viewer' THEN p_permission IN \('entries_read','reports_view'\)/i);
  assert.match(updateMigration, /BEFORE UPDATE ON public\.dictionary_entries/i);
  assert.match(updateMigration, /IF status_changed AND NOT can_publish THEN/i);

  const mayInsert = ({ canCreate, canPublish }, status) =>
    canCreate && (status === 'draft' || canPublish);
  const cases = [
    ['create-only editor', { canCreate: true, canPublish: false }, 'draft', true],
    ['create-only editor', { canCreate: true, canPublish: false }, 'published', false],
    ['create-only editor', { canCreate: true, canPublish: false }, 'archived', false],
    ['publish-enabled staff', { canCreate: true, canPublish: true }, 'published', true],
    ['publish-only staff', { canCreate: false, canPublish: true }, 'published', false],
    ['owner', { canCreate: true, canPublish: true }, 'published', true]
  ];

  for (const [role, permissions, status, expected] of cases) {
    assert.equal(mayInsert(permissions, status), expected, `${role} creating ${status}`);
  }
});

test('dictionary settings keeps ordinary read/update grants but loses excess privileges', () => {
  assert.match(settingsMigration, /REVOKE TRUNCATE, REFERENCES, TRIGGER[\s\S]*?ON TABLE public\.dictionary_settings[\s\S]*?FROM PUBLIC, anon, authenticated/i);
  assert.doesNotMatch(settingsMigration, /REVOKE\s+SELECT|REVOKE\s+UPDATE/i);
});
