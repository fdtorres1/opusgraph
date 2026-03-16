# Decomposition Plan: Ensemble Library Management

## Context

OpusGraph is pivoting from a standalone classical music reference database to a dual-purpose platform: the existing Works Database plus a multi-tenant ensemble library management SaaS. All architecture decisions are locked and documented in `docs/ARCHITECTURE.md` and `docs/SCHEMA.md`. This plan decomposes Phase 0 (foundation) and Phase 1 (MVP) into 36 agent-sized tasks with explicit dependencies and parallelism.

---

## PHASE 0 — Foundation (No UI)

### Parallel Group A: Independent tasks (no dependencies)

| Task | Title | Output Files | Description |
|------|-------|-------------|-------------|
| **P0-1** | Migration: Organizations & Membership | `supabase/migrations/0005_organizations.sql` | `organization` + `org_member` tables, enum types (`org_type`, `org_role`, `plan_tier`), `generate_slug()` function, RLS policies (member read, owner write, manager invite), `ensure_one_owner` trigger, `updated_at` trigger (reuse `update_updated_at()` from 0001_init.sql:196), auto-create personal org trigger on signup (extend pattern from 0002_auto_create_user_profile.sql), helper functions `is_org_member(org_id)` and `is_org_manager_or_owner(org_id)`. Backfill existing users with personal orgs. Pattern: `0001_init.sql` sections 1, 8, 12. Spec: `docs/SCHEMA.md` Slice 1 + Individual Users section. |
| **P0-9** | Middleware: Protect /library routes | `middleware.ts` (modify) | Add `/library/*` to middleware matcher. Check auth only (not org role — that's downstream). Redirect unauthenticated users to `/auth/login?redirect=/library/...`. Leave existing `/admin/*` protection unchanged. Pattern: `middleware.ts:42-63`. |
| **P0-10** | Zod Validators for Library Entities | `lib/validators/library-entry.ts`, `lib/validators/performance.ts`, `lib/validators/organization.ts`, `lib/validators/library-comment.ts`, `lib/validators/library-tag.ts` | Create Zod schemas following patterns from `lib/validators/work.ts` and `lib/validators/composer.ts`. `LibraryEntryPayload`: overrides (strict type with 8 optional fields), copies_owned, location, condition enum, notes, parts array. `PerformancePayload`: date, event_name, venue, season, notes, works array with program_order. `OrganizationPayload`: name, type enum. `LibraryCommentPayload`: body (required), parent_comment_id (optional). `LibraryTagPayload`: name (required), category, color. All export schema + inferred TS type. |
| **P0-11** | Library Display Utility Functions | `lib/library.ts` | `resolveEntryDisplay(entry, work?, composer?, publisher?)` — implements override ?? reference merge for all 8 fields. Returns `{title, composerFirstName, composerLastName, composerDisplayName ("First Last"), composerSortName ("Last, First"), arranger, publisher, instrumentation, duration, yearComposed}`. Also export `conditionOptions` array and `conditionLabel()` helper. Pattern: `lib/duration.ts` (utility style). Spec: `docs/SCHEMA.md` display logic section. |

### After P0-1: Migration tasks (depend on org table)

| Task | Title | Output Files | Deps | Description |
|------|-------|-------------|------|-------------|
| **P0-2** | Migration: Library Entries | `supabase/migrations/0006_library_entries.sql` | P0-1 | `library_entry` + `library_entry_part` tables. FK to `work.id` (ON DELETE SET NULL), JSONB `overrides` with default `'{}'`, condition CHECK (excellent/good/fair/poor/missing), `updated_at` trigger, indexes, RLS using `is_org_member()` and `is_org_manager_or_owner()`. Pattern: `0001_init.sql:114-160` (work + work_source). Spec: `docs/SCHEMA.md` Slice 2. |
| **P0-5** | Migration: Tags | `supabase/migrations/0009_library_tags.sql` | P0-1 | `library_tag` + `library_entry_tag` tables. UNIQUE on `(organization_id, name)`. Composite PK on join table. RLS inherits from library_entry. Pattern: `0001_init.sql:306-316`. Spec: `docs/SCHEMA.md` Slice 5. |
| **P0-7** | Migration: Audit Trail Extension | `supabase/migrations/0011_audit_extension.sql` | P0-1 | Expand `entity_kind` enum (add library_entry, performance, organization, org_member, library_tag). Expand `revision_action` enum (add delete, invite, remove, role_change). Add `organization_id` column to `revision` (nullable FK). Update `activity_event` view to handle new entity types with org-scoped filtering. Update RLS on revision for org member access. Pattern: `0001_init.sql:11-29, 175-184, 461-519`. Spec: `docs/SCHEMA.md` Slice 7. |
| **P0-8** | Org Auth Helpers | `lib/org.ts` | P0-1 | `getOrgContext(orgSlug)` — looks up org by slug, verifies user is member via `org_member`, returns `{org, membership}` or throws 401/403. `requireOrgRole(orgSlug, ...roles)` — calls getOrgContext + checks role. Uses `createServerSupabase()`. Pattern: `lib/auth.ts` + inline auth checks in `app/api/admin/works/[id]/route.ts:36-38`. |

### After P0-2: Tables that FK to library_entry

| Task | Title | Output Files | Deps | Description |
|------|-------|-------------|------|-------------|
| **P0-3** | Migration: Performances | `supabase/migrations/0007_performances.sql` | P0-1, P0-2 | `performance` + `performance_work` tables. UNIQUE on `(performance_id, library_entry_id)` and `(performance_id, program_order)`. `updated_at` trigger. RLS matching library_entry pattern. Spec: `docs/SCHEMA.md` Slice 3. |
| **P0-4** | Migration: Library Search Index | `supabase/migrations/0008_library_search.sql` | P0-2 | `library_entry_search` table with tsvector. Trigger function builds search_vector from overrides (title, composer_first_name, composer_last_name, arranger, publisher) + notes + part names. Fires on library_entry INSERT/UPDATE and library_entry_part INSERT/UPDATE/DELETE. GIN index. RLS org-scoped. Pattern: `0001_init.sql:189-236` (work_search). Spec: `docs/SCHEMA.md` Slice 4. |
| **P0-6** | Migration: Library Comments | `supabase/migrations/0010_library_comments.sql` | P0-2 | `library_comment` table with threading (parent_comment_id FK). RLS: all org members read+write, only author can UPDATE/DELETE own. Indexes on library_entry_id and parent_comment_id. Pattern: `0001_init.sql:165-173` (admin_comment). Spec: `docs/SCHEMA.md` Slice 6. |

---

## PHASE 1 — MVP Library Management

### Parallel Group C: API Routes (after all P0 tasks)

| Task | Title | Output Files | Deps | Description |
|------|-------|-------------|------|-------------|
| **P1-1** | API: Library Entry CRUD | `app/api/library/entries/route.ts`, `app/api/library/entries/[id]/route.ts` | P0-1,2,7,8,10 | POST creates entry with overrides + optional reference_work_id + parts. GET returns entry with joined work/composer/publisher data + parts + tags. PATCH validates with `LibraryEntryPayload`, updates entry, delete+reinsert parts, logs revision. DELETE requires manager/owner, logs revision. All routes use `getOrgContext()` via org_id header. Pattern: `app/api/admin/works/route.ts` + `app/api/admin/works/[id]/route.ts`. |
| **P1-3** | API: Reference Work Search | `app/api/library/reference/search/route.ts` | P0-8 | GET with `q` param searches published works by name. Returns `{results: [{id, work_name, composer, instrumentation_text, duration_seconds, publisher}]}`. Limit 20. Any authenticated user. Pattern: `app/api/admin/search/composers/route.ts`. |
| **P1-4** | API: Performance CRUD | `app/api/library/performances/route.ts`, `app/api/library/performances/[id]/route.ts` | P0-1,2,3,7,8,10 | POST creates performance + performance_work rows with program_order. GET returns performance with program (joined entry display data). PATCH updates, delete+reinsert performance_work. DELETE requires manager/owner, logs revision. Pattern: `app/api/admin/works/[id]/route.ts`. |
| **P1-5** | API: Library Comments | `app/api/library/entries/[id]/comments/route.ts` | P0-1,2,6,8,10 | GET returns threaded comments with author info. POST creates (any org member). PATCH updates body (author only). DELETE removes (author only). Pattern: `app/api/admin/works/[id]/route.ts` (CRUD boilerplate). |
| **P1-6** | API: Library Tags | `app/api/library/tags/route.ts`, `app/api/library/tags/[id]/route.ts`, `app/api/library/entries/[id]/tags/route.ts` | P0-1,2,5,8,10 | Tag CRUD scoped to org (manager/owner only). Entry tag assignment via PUT (delete+reinsert). Tag names unique within org. |
| **P1-7** | API: Library Stats | `app/api/library/stats/route.ts` | P0-1,2,3,8 | Returns `{entries: {total, byCondition}, performances: {total}, recentEntries, recentPerformances}`. Org-scoped. Any member. Pattern: `app/api/admin/stats/route.ts`. |
| **P1-8** | API: Library Activity Feed | `app/api/library/activity/route.ts` | P0-1,7,8 | Queries extended `activity_event` view filtered by `organization_id`. Supports source/entity_type filters, offset/limit pagination. Pattern: `app/api/admin/activity/route.ts`. |

### After P1-1: Search and Import APIs

| Task | Title | Output Files | Deps | Description |
|------|-------|-------------|------|-------------|
| **P1-2** | API: Library Entry Search | `app/api/library/entries/search/route.ts` | P0-4, P1-1 | Full-text search via `library_entry_search`. Filters: condition, tag_id. Sort: title, composer_last_name, created_at. Pagination offset/limit (default 50). Returns entries with resolved display data + total count. |
| **P1-9** | API: Library CSV Import (Parse) | `app/api/library/import/parse/route.ts` | P0-8 | Clone `app/api/admin/import/parse/route.ts` exactly. File upload → PapaParse → return headers + rows. |
| **P1-10** | API: Library CSV Import (Validate) | `app/api/library/import/validate/route.ts` | P0-1,2,8,10 | Validate mapped rows for library fields (title required, condition enum, copies numeric). Fuzzy duplicate check within org. Pattern: `app/api/admin/import/validate/route.ts`. |
| **P1-11** | API: Library CSV Import (Execute) | `app/api/library/import/execute/route.ts` | P0-1,2,7,8,10 | Insert validated rows as library_entry with overrides JSONB. Attempt reference work matching (fuzzy). Log revisions. Manager/owner only. Pattern: `app/api/admin/import/execute/route.ts`. |

### Parallel Group E: Layout (after P0-8, P0-9)

| Task | Title | Output Files | Deps | Description |
|------|-------|-------------|------|-------------|
| **P1-12** | Library Layout & Sidebar | `app/library/[orgSlug]/layout.tsx`, `components/library-sidebar.tsx` | P0-1,8,9 | `SidebarProvider` + `SidebarInset` with org name in header. Sidebar nav: Dashboard, Catalog (All / Add New), Performances, Import, Activity, Tags, Settings. Org switcher if multi-org user. Personal orgs show "My Library". `force-dynamic`. Server component calls `getOrgContext()`. Footer: user email + logout. Pattern: `app/admin/layout.tsx` + `components/admin-sidebar.tsx`. |

### Parallel Group F: UI Pages (after P1-12 + respective APIs)

| Task | Title | Output Files | Deps | Description |
|------|-------|-------------|------|-------------|
| **P1-13** | Library Dashboard Page | `app/library/[orgSlug]/page.tsx`, `app/library/[orgSlug]/dashboard-client.tsx` | P1-7,12 | Server component fetches stats. Stat cards (total entries, by condition, total performances). Quick actions (Add Entry, Search Catalog, Log Performance). Recent activity preview. Pattern: `app/admin/page.tsx`. |
| **P1-14** | Catalog List & Search Page | `app/library/[orgSlug]/catalog/page.tsx`, `app/library/[orgSlug]/catalog/catalog-client.tsx` | P1-2,12, P0-11 | Search input with debounce → search API. Filter by condition, tag. Sort by title, composer, date added. Grid of Cards showing resolved display data + condition badge + "Missing Parts" badge. Pattern: `app/admin/works/page.tsx` (list) + `app/admin/activity/page.tsx` (client-side fetch with filters). |
| **P1-15** | Entry Editor: Server Page | `app/library/[orgSlug]/catalog/[id]/page.tsx` | P1-1,12, P0-8 | Handles `id === "new"` case. Fetches entry with parts, tags, joined reference data. Passes to client editor. 404 if wrong org. Pattern: `app/admin/works/[id]/page.tsx`. |
| **P1-16** | Entry Editor: Core Form | `app/library/[orgSlug]/catalog/[id]/entry-editor.tsx` | P1-1,15, P0-10,11 | `useForm` + `zodResolver(LibraryEntryPayload)`. 800ms debounced autosave. Saving state machine. `lastSavedRef` for discard. Override fields: title, composer first/last, arranger, publisher, instrumentation, duration, year. Library fields: copies_owned, location, condition select, notes. Delete + discard dialogs. New entries: POST then `router.replace`. Pattern: `app/admin/works/[id]/work-editor.tsx`. |
| **P1-17** | Entry Editor: Reference Lookup | `app/library/[orgSlug]/catalog/[id]/entry-editor.tsx` (modify) | P1-3,16 | Typeahead at top of editor. On select: set `reference_work_id`, show reference data as placeholders. "Linked to: [Work] by [Composer]" badge with unlink button. Unlinking preserves user overrides. Pattern: work-editor.tsx Typeahead component. |
| **P1-18** | Entry Editor: Parts Management | `app/library/[orgSlug]/catalog/[id]/entry-editor.tsx` (modify) | P1-16 | `useFieldArray` for parts. Each row: part_name, quantity, condition select, notes, remove button. "+ Add Part" button. Parts in autosave payload. "Missing Parts" badge derived from parts with condition='missing'. Pattern: work-editor.tsx useFieldArray for sources. |
| **P1-19** | Entry Editor: Tags Section | `app/library/[orgSlug]/catalog/[id]/entry-editor.tsx` (modify) | P1-6,16 | Tags as colored badges with remove. Typeahead to search/add org tags. Create new tag inline. Saved via PUT. |
| **P1-20** | Entry Editor: Comments | `app/library/[orgSlug]/catalog/[id]/entry-comments.tsx`, `app/library/[orgSlug]/catalog/[id]/page.tsx` (modify) | P1-5,15 | Client component below editor. Threaded comments with author name + timestamp. Add/Reply/Edit/Delete. All org roles can comment. Optimistic UI. |
| **P1-21** | Performance List Page | `app/library/[orgSlug]/performances/page.tsx` | P1-4,12 | Server component. Cards: date, event_name, venue, season, program count. Ordered by date desc. "Log New Performance" button. Limit 100. Pattern: `app/admin/works/page.tsx`. |
| **P1-22** | Performance Editor | `app/library/[orgSlug]/performances/[id]/page.tsx`, `app/library/[orgSlug]/performances/[id]/performance-editor.tsx` | P1-4,2,12, P0-10 | Server page + client editor. Form: date, event_name, venue, season, notes. Program builder: typeahead to search catalog, add to program with ordering (up/down buttons), remove. Autosave. Delete with confirmation. |
| **P1-23** | CSV Import Page | `app/library/[orgSlug]/import/page.tsx`, `app/library/[orgSlug]/import/csv-import.tsx` | P1-9,10,11,12 | Multi-step wizard: upload → map → validate → execute → results. Map to library fields. Results with links to created entries. Pattern: `app/admin/import/csv-import.tsx`. |
| **P1-24** | Activity Feed Page | `app/library/[orgSlug]/activity/page.tsx` | P1-8,12 | Client component. Filter by source/entity_type. Grouped by date. Entity links to `/library/[orgSlug]/catalog/[id]` or `.../performances/[id]`. "Load More" pagination. Pattern: `app/admin/activity/page.tsx`. |
| **P1-25** | Tag Management Page | `app/library/[orgSlug]/tags/page.tsx`, `app/library/[orgSlug]/tags/tag-manager.tsx` | P1-6,12 | List org tags with name, category, color badge, entry count. Create/Edit/Delete (manager/owner only). |

---

## Dependency Graph & Parallelism

```
WAVE 1 (4 parallel):  P0-1, P0-9, P0-10, P0-11

WAVE 2 (5 parallel, after P0-1):  P0-2, P0-5, P0-7, P0-8  +  P0-9 if not done

WAVE 3 (3 parallel, after P0-2):  P0-3, P0-4, P0-6

WAVE 4 (8 parallel, after all P0):  P1-1, P1-3, P1-4, P1-5, P1-6, P1-7, P1-8, P1-12

WAVE 5 (4 parallel, after P1-1):  P1-2, P1-9, P1-10, P1-11

WAVE 6 (13 parallel, after P1-12 + respective APIs):
  P1-13, P1-14, P1-15+P1-16, P1-20, P1-21, P1-22, P1-23, P1-24, P1-25

WAVE 7 (3 parallel, after P1-16):  P1-17, P1-18, P1-19
```

Maximum parallelism: 13 tasks (Wave 6). Minimum critical path: 7 waves.

---

## Critical Pattern Reference Files

Every agent task references these — read them before implementing:

| File | What It Provides |
|------|-----------------|
| `supabase/migrations/0001_init.sql` | Table, enum, trigger, RLS, search index, helper function patterns |
| `app/api/admin/works/[id]/route.ts` | Canonical CRUD API: auth checks, Zod validation, child record delete+reinsert, revision logging |
| `app/admin/works/[id]/work-editor.tsx` | Canonical editor: react-hook-form, zodResolver, 800ms autosave, saving state machine, useFieldArray, dialogs |
| `app/admin/layout.tsx` + `components/admin-sidebar.tsx` | Layout + sidebar patterns |
| `app/admin/import/csv-import.tsx` | Multi-step CSV import wizard |
| `app/admin/activity/page.tsx` | Client-side activity feed with filters and pagination |
| `docs/SCHEMA.md` | Authoritative table specs for all 7 migration slices |
| `docs/ARCHITECTURE.md` | System design, auth layers, route structure, key decisions |

---

## Verification

After each wave completes:
- **Migrations**: Apply via `supabase db push` or SQL editor. Verify tables, constraints, indexes, RLS policies exist.
- **API routes**: `npm run build` passes (TypeScript check). Manual test with curl or Postman.
- **UI pages**: `npm run dev`, navigate to pages, verify rendering and data flow.
- **End-to-end**: After Wave 6, verify full workflow: sign up → personal org created → add library entry (with reference lookup) → add parts → tag it → comment → log performance → search catalog → import CSV → view activity feed.
