# Architecture

This document describes the technical architecture of OpusGraph, a dual-purpose platform combining a classical music reference database with a multi-tenant ensemble library management SaaS.

---

## System Overview

The application has two coexisting domains:

1. **Reference Database** — A global, curated catalog of composers and musical works. Managed by platform admins. Read-only for customers. This is the original OpusGraph.
2. **Library Management** — Per-organization catalogs of owned sheet music. Managed by org members. Each org sees only its own data. This is the SaaS product.

Library entries can optionally link to a reference work, inheriting metadata (instrumentation, duration, publisher) while storing library-specific fields (copies owned, location, condition, parts). Users can also create library entries for works not in the reference database.

```
┌─────────────────────────────────────────────────────┐
│                    Platform Admins                   │
│         (super_admin, admin, contributor)            │
│                                                     │
│  Manage: composers, works, review flags, imports    │
│  Routes: /admin/*                                   │
│  Auth:   user_profile.admin_role                    │
└──────────────────────┬──────────────────────────────┘
                       │ curates
                       ▼
┌─────────────────────────────────────────────────────┐
│               Reference Database                     │
│                                                     │
│  Tables: composer, work, work_source,               │
│          work_recording, revision, review_flag       │
│  Access: read-only for customers                    │
│          auto-populate on catalog entry              │
└──────────────────────┬──────────────────────────────┘
                       │ optional FK (reference_work_id)
                       ▼
┌─────────────────────────────────────────────────────┐
│              Library Management (per-org)            │
│                                                     │
│  Tables: organization, org_member, library_entry,   │
│          library_entry_part, library_comment,        │
│          performance, performance_work               │
│  Routes: /library/[orgSlug]/*                       │
│  Auth:   org_member.role (owner, manager, member)   │
└──────────────────────┬──────────────────────────────┘
                       │ belongs to
                       ▼
┌─────────────────────────────────────────────────────┐
│              Organizations & Users                   │
│                                                     │
│  Tables: organization, org_member, user_profile     │
│  Billing: org-level (covers all members)            │
│           personal orgs (individuals) billed solo   │
└─────────────────────────────────────────────────────┘
```

---

## Two-Layer Authentication & Authorization

### Layer 1: Platform Admin (existing)

Controls access to the reference database management interface at `/admin/*`.

| Role | Permissions |
|------|------------|
| `super_admin` | Full platform control. Manage all reference data, users, orgs. |
| `admin` | Manage reference data. Delete entities. Moderate orgs. |
| `contributor` | Create/edit reference data. No deletion. |

Stored in: `user_profile.admin_role`
Enforced by: `middleware.ts` (route guard) + API route checks + RLS policies.

A user can be both a platform admin AND an org member. These are independent.

### Layer 2: Organization (new)

Controls access to library management features at `/library/*`.

| Role | Permissions |
|------|------------|
| `owner` | Full org control: billing, settings, invite/remove users, full library CRUD. At least one per org. |
| `manager` | Full library CRUD. Can invite users. No billing or org settings access. |
| `member` | Read-only library access. Can view catalog, search, browse. Can comment on library entries. |

Stored in: `org_member.role`
Enforced by: middleware (route guard) + API route checks + RLS policies.

A user can belong to multiple organizations with different roles in each.

### Individual Users

Individual users are modeled as single-member organizations to eliminate dual code paths. On signup, a personal org is auto-created with the user as `owner`. The UI shows "My Library" or "Personal Library" — the user never sees the word "organization."

- Billed individually (the personal org is the billing entity)
- Same RLS policies as any other org (no special `NULL` scoping)
- Can access the reference database based on their subscription tier
- Can convert their personal library to an ensemble org by renaming and inviting members

---

## Multi-Tenancy

All library data is scoped by `organization_id`. RLS policies enforce tenant isolation at the database level.

### RLS Strategy

Since all users belong to an org (individuals get a personal org), RLS uses a single pattern:

```sql
-- Org members can only see their own org's data
CREATE POLICY "org_member_read" ON library_entry
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM org_member
      WHERE user_id = auth.uid()
    )
  );

-- Only managers and owners can write
CREATE POLICY "org_manager_write" ON library_entry
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM org_member
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );
```

### Org Context Resolution

The current organization is determined by the URL slug: `/library/[orgSlug]/catalog`.

- Org context is explicit in every request (not dependent on cookie state)
- Links are shareable and unambiguous between org members
- Defense in depth: RLS is the real enforcement layer, URL is an additional check
- If a user belongs to multiple orgs, they navigate between them via an org switcher that changes the URL

---

## Data Model: Reference ↔ Library Relationship

Library entries store **only library-specific fields**. Reference data is inherited via FK, not copied.

```
library_entry
├── id, organization_id, created_by
├── reference_work_id (nullable FK → work.id)
├── overrides (JSONB, strict type) ← org-specific field customizations
│   {title, composer_first_name, composer_last_name, arranger,
│    publisher, instrumentation, duration, year_composed}
├── copies_owned, location, condition, notes
└── library_entry_part (child table for structured parts)

Display logic:
  title               = overrides.title               ?? work.work_name
  composer_first_name = overrides.composer_first_name ?? composer.first_name
  composer_last_name  = overrides.composer_last_name  ?? composer.last_name
    display_name      = "First Last" (display) / "Last, First" (sort)
  arranger            = overrides.arranger            ?? work.arranger
  publisher           = overrides.publisher           ?? publisher.name
  instrumentation     = overrides.instrumentation    ?? work.instrumentation_text
  duration            = overrides.duration            ?? work.duration_seconds
  year_composed       = overrides.year_composed       ?? work.composition_year

  has_missing_parts   = derived from library_entry_part where condition = 'missing'
```

When `reference_work_id` is NULL, the entry is fully standalone — all metadata lives in `overrides`.

When `reference_work_id` is set, the UI merges reference data with any overrides. This avoids data duplication while allowing org-specific customization.

---

## Route Structure

### Existing (Reference DB Admin)
```
/admin/                    → Dashboard, stats
/admin/composers/          → List, create, edit composers
/admin/works/              → List, create, edit works
/admin/activity/           → Activity feed
/admin/review/             → Review queue
/admin/import/             → CSV import (reference data)
/admin/profile/            → User profile
```

### New (Library Management)
```
/library/[orgSlug]/                  → Library dashboard
/library/[orgSlug]/catalog/          → Browse/search library entries
/library/[orgSlug]/catalog/new       → Add new entry (with Works Database lookup)
/library/[orgSlug]/catalog/[id]      → Edit library entry + comments
/library/[orgSlug]/performances/     → Performance history
/library/[orgSlug]/performances/new  → Log a new performance
/library/[orgSlug]/performances/[id] → Performance detail / edit program
/library/[orgSlug]/import/           → CSV import (library data)
/library/[orgSlug]/activity/         → Org activity feed (audit trail)
/library/[orgSlug]/settings/         → Org settings, members, billing
```

### Existing (Public)
```
/                          → Landing / redirect
/search                    → Public search (reference DB)
/composers/                → Browse published composers
/composers/[id]            → Composer detail
/works/                    → Browse published works
/works/[id]                → Work detail
/auth/login                → Login
/auth/signup               → Signup
```

---

## API Route Structure

### Existing (Reference DB Admin)
```
/api/admin/composers/           → POST (create)
/api/admin/composers/[id]       → GET, PATCH, DELETE
/api/admin/works/               → POST (create)
/api/admin/works/[id]           → GET, PATCH, DELETE
/api/admin/search/composers     → GET (typeahead)
/api/admin/search/publishers    → GET (typeahead)
/api/admin/search/countries     → GET (typeahead)
/api/admin/import/              → parse, validate, execute
/api/admin/review/[id]          → GET, PATCH, compare, merge
/api/admin/activity             → GET
/api/admin/stats                → GET
```

### New (Library Management)
```
/api/library/entries/           → POST (create)
/api/library/entries/[id]       → GET, PATCH, DELETE
/api/library/entries/[id]/comments → GET, POST (threaded comments)
/api/library/entries/search     → GET (search/filter library)
/api/library/performances/      → POST (create)
/api/library/performances/[id]  → GET, PATCH, DELETE
/api/library/import/            → parse, validate, execute (library CSV)
/api/library/reference/search   → GET (search Works Database for auto-populate)
/api/library/settings/          → GET, PATCH (org settings)
/api/library/members/           → GET, POST, DELETE (org members)
/api/library/activity           → GET (org-scoped audit trail)
/api/library/stats              → GET (library dashboard stats)
```

All library API routes require an `organization_id` header or query param, validated against the user's org membership.

---

## Supabase Client Usage

| Client | Location | Use Case |
|--------|----------|----------|
| `lib/supabase/server.ts` | Server components, API routes | Authenticated reads/writes with user session |
| `lib/supabase/client.ts` | Client components | Browser-side authenticated operations |
| `lib/supabase/public.ts` | Public pages | Unauthenticated read-only access to published reference data |

All three clients continue to work as-is. Library management routes use `server.ts` and `client.ts` — RLS handles tenant scoping automatically.

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Separate tables for reference vs. library data | Avoids polluting curated reference data with per-org metadata. Clean separation of concerns. |
| JSONB `overrides` column on library_entry | Allows orgs to customize any reference field without duplicating the full schema. Merge logic is simple: `override ?? reference`. |
| Structured `library_entry_part` table | Parts data is inherently structured (part name + quantity + condition). Free text would lose queryability. Leverages existing instrumentation patterns from reference schema. |
| `program_order` on performance_work join | Costs nothing now, enables concert program generation later (P2). |
| Organization-level billing | Matches the real-world buying pattern: the org pays, members get access. Individual billing is the fallback for solo users. |
| Separate route trees (`/admin` vs `/library`) | Clear separation of platform admin vs. customer features. Different auth checks, different middleware logic, different RLS policies. |
| URL-based org context (`/library/[orgSlug]/...`) | Explicit org in every request. Shareable links. No stale cookie risk. RLS is the real enforcement; URL is defense in depth. |
| Individual users as single-member orgs | One RLS pattern, one billing path, one code path. UI shows "My Library" — no "organization" language for solo users. |
| Unified audit trail (extended `revision` table) | Single `revision` table covers both reference DB and library changes. `organization_id` column (nullable) scopes library audit to the org. One `activity_event` view for the whole system. |
| Separate `library_comment` table (not extending `admin_comment`) | Different scoping: `admin_comment` is platform-internal (visible to admins), `library_comment` is org-scoped (visible to all org members including read-only members). |
| All org roles can comment | Members are read-only for catalog CRUD but can comment. Enables section leaders, conductors, and volunteers to flag issues ("need 4 more copies", "bowings marked in copy #3"). |
| Composer name split in overrides | `composer_first_name` + `composer_last_name` enables sort-by-last-name. Display name derived in application layer. Matches reference DB `composer` table structure. |
| Condition enum: `excellent, good, fair, poor, missing` | Same enum on both `library_entry` and `library_entry_part`. "Missing parts" status derived from child parts, not stored on the entry. |
