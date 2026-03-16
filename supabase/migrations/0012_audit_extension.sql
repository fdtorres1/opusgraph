-- =========
-- NOTE: Enum extensions are in 0011_enum_extensions.sql (must run first, outside transaction)
-- =========

-- =========
-- 1. Add organization_id to revision
-- =========

ALTER TABLE revision ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organization(id);

CREATE INDEX IF NOT EXISTS idx_revision_org
  ON revision(organization_id) WHERE organization_id IS NOT NULL;

-- =========
-- 2. Update activity_event view
-- =========

CREATE OR REPLACE VIEW activity_event AS
-- Reference DB: revision events (composer, work)
WITH rev AS (
  SELECT
    r.id,
    r.created_at AS occurred_at,
    r.actor_user_id AS actor_id,
    CASE r.entity_type
      WHEN 'composer' THEN (SELECT coalesce(c.first_name || ' ' || c.last_name, 'Composer') FROM composer c WHERE c.id = r.entity_id)
      WHEN 'work' THEN (SELECT coalesce(w.work_name, 'Work') FROM work w WHERE w.id = r.entity_id)
    END AS subject_label,
    r.entity_type,
    r.entity_id,
    CASE r.action
      WHEN 'create' THEN 'created'
      WHEN 'update' THEN 'updated'
      WHEN 'publish' THEN 'published'
      WHEN 'unpublish' THEN 'unpublished'
      ELSE r.action::text
    END AS verb,
    null::uuid AS comment_id,
    'revision'::text AS source,
    r.organization_id
  FROM revision r
  WHERE r.entity_type IN ('composer', 'work')
),
-- Reference DB: admin comment events
cm AS (
  SELECT
    ac.id,
    ac.created_at AS occurred_at,
    ac.author_user_id AS actor_id,
    CASE ac.entity_type
      WHEN 'composer' THEN (SELECT coalesce(c.first_name || ' ' || c.last_name, 'Composer') FROM composer c WHERE c.id = ac.entity_id)
      WHEN 'work' THEN (SELECT coalesce(w.work_name, 'Work') FROM work w WHERE w.id = ac.entity_id)
    END AS subject_label,
    ac.entity_type,
    ac.entity_id,
    'commented' AS verb,
    ac.id AS comment_id,
    'comment'::text AS source,
    null::uuid AS organization_id
  FROM admin_comment ac
),
-- Reference DB: review flag events
rf AS (
  SELECT
    rflag.id,
    rflag.created_at AS occurred_at,
    rflag.created_by AS actor_id,
    CASE rflag.entity_type
      WHEN 'composer' THEN (SELECT coalesce(c.first_name || ' ' || c.last_name, 'Composer') FROM composer c WHERE c.id = rflag.entity_id)
      WHEN 'work' THEN (SELECT coalesce(w.work_name, 'Work') FROM work w WHERE w.id = rflag.entity_id)
    END AS subject_label,
    rflag.entity_type,
    rflag.entity_id,
    'flagged for review' AS verb,
    null::uuid AS comment_id,
    'review_flag'::text AS source,
    null::uuid AS organization_id
  FROM review_flag rflag
),
-- Library: library_entry revisions
le AS (
  SELECT
    r.id,
    r.created_at AS occurred_at,
    r.actor_user_id AS actor_id,
    coalesce(r.snapshot->>'title', r.snapshot->'overrides'->>'title', 'Library Entry') AS subject_label,
    r.entity_type,
    r.entity_id,
    CASE r.action
      WHEN 'create' THEN 'created'
      WHEN 'update' THEN 'updated'
      WHEN 'delete' THEN 'deleted'
      ELSE r.action::text
    END AS verb,
    null::uuid AS comment_id,
    'revision'::text AS source,
    r.organization_id
  FROM revision r
  WHERE r.entity_type = 'library_entry'
),
-- Library: performance revisions
perf AS (
  SELECT
    r.id,
    r.created_at AS occurred_at,
    r.actor_user_id AS actor_id,
    coalesce(r.snapshot->>'event_name', 'Performance') AS subject_label,
    r.entity_type,
    r.entity_id,
    CASE r.action
      WHEN 'create' THEN 'created'
      WHEN 'update' THEN 'updated'
      WHEN 'delete' THEN 'deleted'
      ELSE r.action::text
    END AS verb,
    null::uuid AS comment_id,
    'revision'::text AS source,
    r.organization_id
  FROM revision r
  WHERE r.entity_type = 'performance'
),
-- Library: organization revisions
org AS (
  SELECT
    r.id,
    r.created_at AS occurred_at,
    r.actor_user_id AS actor_id,
    coalesce(r.snapshot->>'name', 'Organization') AS subject_label,
    r.entity_type,
    r.entity_id,
    CASE r.action
      WHEN 'update' THEN 'updated'
      ELSE r.action::text
    END AS verb,
    null::uuid AS comment_id,
    'revision'::text AS source,
    r.organization_id
  FROM revision r
  WHERE r.entity_type = 'organization'
),
-- Library: org_member revisions
om AS (
  SELECT
    r.id,
    r.created_at AS occurred_at,
    r.actor_user_id AS actor_id,
    coalesce(
      r.snapshot->>'first_name' || ' ' || r.snapshot->>'last_name',
      'Member'
    ) AS subject_label,
    r.entity_type,
    r.entity_id,
    CASE r.action
      WHEN 'invite' THEN 'invited'
      WHEN 'role_change' THEN 'changed role of'
      WHEN 'remove' THEN 'removed'
      ELSE r.action::text
    END AS verb,
    null::uuid AS comment_id,
    'revision'::text AS source,
    r.organization_id
  FROM revision r
  WHERE r.entity_type = 'org_member'
),
-- Library: library_tag revisions
lt AS (
  SELECT
    r.id,
    r.created_at AS occurred_at,
    r.actor_user_id AS actor_id,
    coalesce(r.snapshot->>'name', 'Tag') AS subject_label,
    r.entity_type,
    r.entity_id,
    CASE r.action
      WHEN 'create' THEN 'created'
      WHEN 'update' THEN 'updated'
      WHEN 'delete' THEN 'deleted'
      ELSE r.action::text
    END AS verb,
    null::uuid AS comment_id,
    'revision'::text AS source,
    r.organization_id
  FROM revision r
  WHERE r.entity_type = 'library_tag'
)
SELECT * FROM rev
UNION ALL SELECT * FROM cm
UNION ALL SELECT * FROM rf
UNION ALL SELECT * FROM le
UNION ALL SELECT * FROM perf
UNION ALL SELECT * FROM org
UNION ALL SELECT * FROM om
UNION ALL SELECT * FROM lt
ORDER BY occurred_at DESC;

-- =========
-- 3. RLS Policies on revision
-- =========

-- Org members can read revisions belonging to their organization
DROP POLICY IF EXISTS read_revision_org_member ON revision;
CREATE POLICY read_revision_org_member ON revision
FOR SELECT USING (
  organization_id IS NOT NULL
  AND is_org_member(organization_id)
);

-- Org managers/owners can insert revisions for their organization
DROP POLICY IF EXISTS insert_revision_org_manager ON revision;
CREATE POLICY insert_revision_org_manager ON revision
FOR INSERT WITH CHECK (
  organization_id IS NOT NULL
  AND is_org_manager_or_owner(organization_id)
);

-- =========
-- Done
-- =========
