# Schema: Library Management Tables

This document specifies the new database tables for the library management layer. These tables coexist with the existing reference database schema (composer, work, etc.) defined in `supabase/migrations/0001_init.sql`.

Each section is a self-contained migration slice.

---

## Slice 1: Organization & Membership

### `organization`

The subscription and billing unit. Each org represents an ensemble (orchestra, choir, band, church music program).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | Display name (e.g., "Mesquite Symphony Orchestra") |
| `slug` | `text` | UNIQUE, NOT NULL | URL-safe identifier, auto-generated from name |
| `type` | `text` | CHECK IN ('orchestra', 'choir', 'band', 'church', 'school', 'other') | Ensemble type |
| `plan_tier` | `text` | CHECK IN ('free', 'starter', 'professional'), default 'free' | Subscription tier |
| `stripe_customer_id` | `text` | NULLABLE, UNIQUE | Stripe customer reference |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | default `now()`, trigger-maintained | |

**Indexes:**
- `idx_organization_slug` UNIQUE on `slug`
- `idx_organization_stripe` on `stripe_customer_id` WHERE NOT NULL

### `org_member`

Join table between users and organizations. A user can belong to multiple orgs.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `organization_id` | `uuid` | FK → organization.id ON DELETE CASCADE, NOT NULL | |
| `user_id` | `uuid` | FK → auth.users.id ON DELETE CASCADE, NOT NULL | |
| `role` | `text` | CHECK IN ('owner', 'manager', 'member'), NOT NULL, default 'member' | |
| `invited_by` | `uuid` | FK → auth.users.id, NULLABLE | Who invited this user |
| `created_at` | `timestamptz` | default `now()` | |

**Constraints:**
- UNIQUE on `(organization_id, user_id)` — a user can only have one role per org
- At least one `owner` per org (enforced via trigger, not constraint)

**RLS Policies:**
- Members can read their own org's membership list
- Owners and managers can insert (invite) new members
- Only owners can update roles or delete members
- Only owners can delete the organization

---

## Slice 2: Library Entries

### `library_entry`

The core catalog entity. Each row is a piece of music in an org's library.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `organization_id` | `uuid` | FK → organization.id ON DELETE CASCADE, NOT NULL | Every user belongs to an org (individuals get a personal org) |
| `reference_work_id` | `uuid` | FK → work.id ON DELETE SET NULL, NULLABLE | Link to reference DB |
| `overrides` | `jsonb` | default `'{}'::jsonb` | Org-specific overrides for reference fields. Strict type: `{title, composer_first_name, composer_last_name, arranger, publisher, instrumentation, duration, year_composed}` |
| `copies_owned` | `integer` | default 0, CHECK >= 0 | Number of copies/sets owned |
| `location` | `text` | NULLABLE | Physical location (shelf, cabinet, room) |
| `condition` | `text` | CHECK IN ('excellent', 'good', 'fair', 'poor', 'missing'), NULLABLE | Matches `library_entry_part.condition` enum. "Missing parts" status is derived from child parts with `condition = 'missing'`. |
| `notes` | `text` | NULLABLE | Free-text notes |
| `created_by` | `uuid` | FK → auth.users.id, NOT NULL | |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | default `now()`, trigger-maintained | |

**Indexes:**
- `idx_library_entry_org` on `organization_id`
- `idx_library_entry_ref` on `reference_work_id` WHERE NOT NULL
- `idx_library_entry_search` GIN on `overrides` for JSONB queries
- Full-text search index on overrides->>'title', overrides->>'composer_first_name', overrides->>'composer_last_name' (tsvector, added in a later slice)

**RLS Policies:**
- Org members can read entries for their org
- Managers and owners can insert/update/delete

**Display Logic (application layer, not DB):**
```
title              = overrides->>'title'              ?? work.work_name
composer_last_name = overrides->>'composer_last_name' ?? composer.last_name
composer_first_name= overrides->>'composer_first_name'?? composer.first_name
  display_name     = "First Last" (for display), "Last, First" (for sort)
arranger           = overrides->>'arranger'           ?? work.arranger
publisher          = overrides->>'publisher'          ?? publisher.name
instrumentation    = overrides->>'instrumentation'    ?? work.instrumentation_text
duration           = overrides->>'duration'           ?? work.duration_seconds
year_composed      = overrides->>'year_composed'      ?? work.composition_year

has_missing_parts  = EXISTS(SELECT 1 FROM library_entry_part WHERE library_entry_id = id AND condition = 'missing')
  → If true, display "Missing Parts" badge alongside entry condition
```

### `library_entry_part`

Structured parts tracking for a library entry. Each row is a specific part (e.g., "Flute 1") with quantity and condition.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `library_entry_id` | `uuid` | FK → library_entry.id ON DELETE CASCADE, NOT NULL | |
| `part_name` | `text` | NOT NULL | e.g., "Flute 1", "Soprano", "Full Score", "Piano-Vocal" |
| `quantity` | `integer` | default 1, CHECK >= 0 | How many copies of this part |
| `condition` | `text` | CHECK IN ('excellent', 'good', 'fair', 'poor', 'missing'), NULLABLE | |
| `notes` | `text` | NULLABLE | e.g., "Pages 12-13 torn", "Marked with bowings" |
| `created_at` | `timestamptz` | default `now()` | |

**Constraints:**
- UNIQUE on `(library_entry_id, part_name)` — one row per part per entry

**Indexes:**
- `idx_library_entry_part_entry` on `library_entry_id`

**RLS Policies:**
- Inherits access from parent library_entry (same org membership check)

---

## Slice 3: Performance History

### `performance`

A single performance event (concert, recital, service, rehearsal).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `organization_id` | `uuid` | FK → organization.id ON DELETE CASCADE, NOT NULL | Every user belongs to an org (individuals get a personal org) |
| `date` | `date` | NOT NULL | Performance date |
| `event_name` | `text` | NOT NULL | e.g., "Spring Concert 2026", "Sunday Service" |
| `venue` | `text` | NULLABLE | e.g., "Mesquite Arts Center" |
| `season` | `text` | NULLABLE | e.g., "2025-2026" |
| `notes` | `text` | NULLABLE | |
| `created_by` | `uuid` | FK → auth.users.id, NOT NULL | |
| `created_at` | `timestamptz` | default `now()` | |
| `updated_at` | `timestamptz` | default `now()`, trigger-maintained | |

**Indexes:**
- `idx_performance_org` on `organization_id`
- `idx_performance_date` on `organization_id, date DESC`

**RLS Policies:**
- Same pattern as library_entry (org member read, manager/owner write)

### `performance_work`

Join table linking performances to library entries, with program order.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `performance_id` | `uuid` | FK → performance.id ON DELETE CASCADE, NOT NULL | |
| `library_entry_id` | `uuid` | FK → library_entry.id ON DELETE CASCADE, NOT NULL | |
| `program_order` | `integer` | NOT NULL | Position in the concert program |
| `notes` | `text` | NULLABLE | e.g., "Encore", "Intermission follows" |

**Constraints:**
- UNIQUE on `(performance_id, library_entry_id)` — a work appears once per performance
- UNIQUE on `(performance_id, program_order)` — no duplicate positions

**Indexes:**
- `idx_performance_work_perf` on `performance_id`
- `idx_performance_work_entry` on `library_entry_id`

**RLS Policies:**
- Inherits access from parent performance (same org membership check)

---

## Slice 4: Library Search Index

Full-text search across library entries within an org.

### `library_entry_search`

Materialized or trigger-maintained search index.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `library_entry_id` | `uuid` | PK, FK → library_entry.id ON DELETE CASCADE | |
| `organization_id` | `uuid` | FK → organization.id, NOT NULL | Denormalized for RLS |
| `search_vector` | `tsvector` | NOT NULL | Combined: title, composer first/last name, arranger, publisher, notes, part names |

**Indexes:**
- `idx_library_search_vector` GIN on `search_vector`
- `idx_library_search_org` on `organization_id`

**Trigger:** Update search_vector on library_entry INSERT/UPDATE and on library_entry_part INSERT/UPDATE/DELETE.

**RLS Policies:**
- Same org-scoped read as library_entry

---

## Slice 5: Tags & Categories

### `library_tag`

Tags for categorizing library entries. Scoped per-org so each org can define their own taxonomy.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `organization_id` | `uuid` | FK → organization.id ON DELETE CASCADE, NOT NULL | Every user belongs to an org (individuals get a personal org) |
| `name` | `text` | NOT NULL | e.g., "Advent", "Grade 3", "Holiday Concert" |
| `category` | `text` | NULLABLE | e.g., "Season", "Difficulty", "Genre" |
| `color` | `text` | NULLABLE | Hex color for UI badges |
| `created_at` | `timestamptz` | default `now()` | |

**Constraints:**
- UNIQUE on `(organization_id, name)` — no duplicate tag names within an org

### `library_entry_tag`

Join table between library entries and tags.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `library_entry_id` | `uuid` | FK → library_entry.id ON DELETE CASCADE, NOT NULL | |
| `library_tag_id` | `uuid` | FK → library_tag.id ON DELETE CASCADE, NOT NULL | |

**Constraints:**
- PK on `(library_entry_id, library_tag_id)`

**RLS Policies:**
- Inherits from library_entry (same org check)

---

## Slice 6: Library Comments

### `library_comment`

Threaded comments on library entries. All org roles (owner, manager, member) can read and write.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `library_entry_id` | `uuid` | FK → library_entry.id ON DELETE CASCADE, NOT NULL | |
| `author_user_id` | `uuid` | FK → auth.users.id, NOT NULL | |
| `body` | `text` | NOT NULL | |
| `parent_comment_id` | `uuid` | FK → library_comment.id ON DELETE CASCADE, NULLABLE | For threading |
| `created_at` | `timestamptz` | default `now()` | |

**Indexes:**
- `idx_library_comment_entry` on `library_entry_id`
- `idx_library_comment_parent` on `parent_comment_id` WHERE NOT NULL

**RLS Policies:**
- All org members can read comments on entries they can see
- All org members can create comments (owner, manager, AND member)
- Only the comment author can update or delete their own comment

---

## Slice 7: Audit Trail Extension

Extend the existing `revision` table and related types to cover the entire application.

### Enum Changes

```sql
-- Expand entity_kind to cover library entities
ALTER TYPE entity_kind ADD VALUE 'library_entry';
ALTER TYPE entity_kind ADD VALUE 'performance';
ALTER TYPE entity_kind ADD VALUE 'organization';
ALTER TYPE entity_kind ADD VALUE 'org_member';
ALTER TYPE entity_kind ADD VALUE 'library_tag';

-- Expand revision_action to cover new actions
ALTER TYPE revision_action ADD VALUE 'delete';
ALTER TYPE revision_action ADD VALUE 'invite';
ALTER TYPE revision_action ADD VALUE 'remove';
ALTER TYPE revision_action ADD VALUE 'role_change';
```

### `revision` Table Changes

| Column | Change | Notes |
|--------|--------|-------|
| `organization_id` | ADD, `uuid` FK → organization.id, NULLABLE | NULL for reference DB changes. Set for library changes. Enables org-scoped activity feeds. |

**Index:**
- `idx_revision_org` on `organization_id` WHERE NOT NULL

### Audit Strategy

| Entity | Actions Tracked | Snapshot Includes |
|--------|----------------|-------------------|
| `library_entry` | create, update, delete | Full entry + parts array |
| `performance` | create, update, delete | Full performance + program (performance_works) |
| `organization` | update | Org settings |
| `org_member` | invite, role_change, remove | Member details + role |
| `library_tag` | create, update, delete | Tag details |
| `library_comment` | create, delete | Comment body (feeds into activity, not stored as revision) |

Child entities (`library_entry_part`, `performance_work`) are included in their parent's snapshot rather than logged as separate revisions.

### Activity View Extension

The existing `activity_event` view will be extended to include library events, filtered by `organization_id` so each org sees only its own activity. Reference DB activity (`organization_id IS NULL`) remains visible only to platform admins.

---

## Existing Tables: No Changes Required

The following existing tables remain unchanged:

| Table | Role in New Architecture |
|-------|------------------------|
| `composer` | Reference DB. Read-only for customers. |
| `work` | Reference DB. Linked via `library_entry.reference_work_id`. |
| `work_source`, `work_recording` | Reference DB detail tables. |
| `revision` | Audit trail for reference DB changes. |
| `review_flag` | QA for reference DB. |
| `admin_comment` | Internal discussion on reference entities. |
| `user_profile` | Platform admin roles. Add no new columns. |
| `place` | Location cache. Can be reused for venue lookups. |
| `country`, `gender_identity`, `ensemble_type`, `publisher` | Lookup tables. Shared across both layers. |

### Tables to Deprecate (Post-Migration)

These existing tables overlap with the new org model and should be removed once the new schema is active:

| Table | Replaced By |
|-------|------------|
| `subscriber` | `org_member` + `user_profile` |
| `subscription` | `organization.plan_tier` + `organization.stripe_customer_id` |
| `team`, `team_member` | `organization`, `org_member` |
| `institution`, `institution_member` | `organization`, `org_member` (type='school' or 'other') |

---

## Individual Users as Single-Member Organizations

Individual users (not part of any ensemble) are modeled as single-member organizations rather than a separate code path. On signup, a personal org is auto-created:

- `organization.name` = "My Library" (user can rename)
- `organization.type` = "other"
- `org_member.role` = "owner"

This eliminates the dual `organization_id IS NULL` / `created_by = auth.uid()` scoping pattern. All library data flows through the same org-based RLS policies. The UI says "My Library" or "Personal Library" — the user never sees the word "organization."

**Impact on RLS:** All library RLS policies use a single pattern (org membership check). No special case for individual users.

**Impact on billing:** Personal orgs are billed individually. Ensemble orgs are billed at the org level.

---

## Migration Sequence

Migrations should be applied in slice order. Each slice is independent and deployable:

```
0005_organizations.sql          ← Slice 1: organization + org_member + auto-create personal org trigger
0006_library_entries.sql        ← Slice 2: library_entry + library_entry_part
0007_performances.sql           ← Slice 3: performance + performance_work
0008_library_search.sql         ← Slice 4: library_entry_search + triggers
0009_library_tags.sql           ← Slice 5: library_tag + library_entry_tag
0010_library_comments.sql       ← Slice 6: library_comment
0011_enum_extensions.sql         ← Slice 7a: ALTER TYPE for entity_kind + revision_action (must run outside transaction)
0012_audit_extension.sql        ← Slice 7b: revision table changes + activity view update + RLS
```

Each migration includes: table creation, indexes, constraints, RLS policies, and triggers.
