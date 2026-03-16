-- =========
-- Enum Extensions for Library Management
-- =========
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- This migration must be run separately before 0012_audit_extension.sql.
-- In Supabase Dashboard SQL Editor, run this file first on its own.

-- Expand entity_kind to cover library entities
ALTER TYPE entity_kind ADD VALUE IF NOT EXISTS 'library_entry';
ALTER TYPE entity_kind ADD VALUE IF NOT EXISTS 'performance';
ALTER TYPE entity_kind ADD VALUE IF NOT EXISTS 'organization';
ALTER TYPE entity_kind ADD VALUE IF NOT EXISTS 'org_member';
ALTER TYPE entity_kind ADD VALUE IF NOT EXISTS 'library_tag';

-- Expand revision_action to cover new actions
ALTER TYPE revision_action ADD VALUE IF NOT EXISTS 'delete';
ALTER TYPE revision_action ADD VALUE IF NOT EXISTS 'invite';
ALTER TYPE revision_action ADD VALUE IF NOT EXISTS 'remove';
ALTER TYPE revision_action ADD VALUE IF NOT EXISTS 'role_change';

-- =========
-- Done
-- =========
