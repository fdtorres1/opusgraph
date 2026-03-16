# OpusGraph Roadmap

## Completed: Reference Database (v1.0–v1.7)

The original OpusGraph reference database is fully functional:
- Composer and work editors with autosave and draft/publish workflow
- RESTful API routes for all CRUD operations
- CSV import with validation and duplicate detection
- Review queue with comparison and merge
- Activity feed with filtering
- Public search, browse, and detail pages
- Authentication with 4-tier RBAC
- Location search (Google Places + Nominatim)
- Deployed on Vercel

See `CHANGELOG.md` for detailed version history through v1.7.6.

---

## Phase 0: Foundation

Multi-tenant infrastructure. No UI — just schema, auth, and middleware.

### 0.1 — Organization & Membership Schema
- [ ] Migration `0005_organizations.sql`: `organization` and `org_member` tables
- [ ] Enum types: `org_type` (orchestra, choir, band, church, school, other)
- [ ] Enum type: `org_role` (owner, manager, member)
- [ ] Enum type: `plan_tier` (free, starter, professional)
- [ ] Slug generation function (URL-safe, unique)
- [ ] RLS policies for org data isolation
- [ ] Trigger: ensure at least one owner per org
- [ ] Trigger: auto-update `updated_at` on organization
- [ ] Trigger: auto-create personal org on user signup (name="My Library", type="other", role="owner")

### 0.2 — Library Entry Schema
- [ ] Migration `0006_library_entries.sql`: `library_entry` and `library_entry_part` tables
- [ ] `library_entry.reference_work_id` FK to existing `work` table
- [ ] `library_entry.overrides` JSONB column for reference field customization
- [ ] Structured `library_entry_part` table (part_name, quantity, condition, notes)
- [ ] RLS policies: org-scoped read/write (individuals are single-member orgs, same pattern)
- [ ] Trigger: auto-update `updated_at`

### 0.3 — Performance History Schema
- [ ] Migration `0007_performances.sql`: `performance` and `performance_work` tables
- [ ] `performance_work.program_order` for concert program ordering
- [ ] RLS policies matching library_entry pattern
- [ ] Trigger: auto-update `updated_at`

### 0.4 — Library Search Index
- [ ] Migration `0008_library_search.sql`: `library_entry_search` table
- [ ] tsvector combining title, composer, arranger, publisher, notes, part names
- [ ] GIN index on search_vector
- [ ] Trigger: rebuild search_vector on library_entry and library_entry_part changes
- [ ] RLS policies for org-scoped search

### 0.5 — Tags Schema
- [ ] Migration `0009_library_tags.sql`: `library_tag` and `library_entry_tag` tables
- [ ] Per-org tag scoping with category support
- [ ] RLS policies inheriting from library_entry

### 0.6 — Library Comments Schema
- [ ] Migration `0010_library_comments.sql`: `library_comment` table
- [ ] Threaded comments (parent_comment_id FK)
- [ ] RLS: all org members (owner, manager, member) can read and write comments
- [ ] Only comment author can update/delete their own comment

### 0.7 — Audit Trail Extension
- [ ] Migration `0011_audit_extension.sql`: extend `revision` table
- [ ] Expand `entity_kind` enum: add library_entry, performance, organization, org_member, library_tag
- [ ] Expand `revision_action` enum: add delete, invite, remove, role_change
- [ ] Add `organization_id` column to `revision` (nullable — NULL for reference DB)
- [ ] Update `activity_event` view to include library events, scoped by org

### 0.8 — Middleware & Auth Updates
- [ ] Extend `middleware.ts` to protect `/library/*` routes
- [ ] Org context resolution from URL slug (`/library/[orgSlug]/...`)
- [ ] API helper: get current user's org membership and role
- [ ] Validate org slug against user's memberships
- [ ] Zod validators for library entry, performance, organization, comment

---

## Phase 1: MVP Library Management

Build for MSO dogfooding. Core CRUD and search.

### 1.1 — Library Dashboard
- [ ] `/library/[orgSlug]` page: org-scoped dashboard
- [ ] Stats: total entries, entries by condition, recent additions
- [ ] Quick actions: add entry, search, log performance
- [ ] Org context switcher (if user belongs to multiple orgs)

### 1.2 — Library Entry Editor
- [ ] `/library/[orgSlug]/catalog/new` and `/library/[orgSlug]/catalog/[id]` pages
- [ ] Reference DB lookup: typeahead search that matches reference works
- [ ] Auto-populate fields from reference work on selection
- [ ] Override any auto-populated field with org-specific values
- [ ] Standalone entry creation (no reference work link)
- [ ] Parts management: add/edit/remove parts with quantity and condition
- [ ] Copies owned, location, condition, notes fields
- [ ] Autosave (reuse 800ms debounce pattern from admin editors)

### 1.3 — Library Catalog Browse & Search
- [ ] `/library/[orgSlug]/catalog` page: list all entries for the org
- [ ] Multi-field search: title, composer, arranger, publisher
- [ ] Filter by condition, location, tag
- [ ] Sort by title, composer, date added, last performed
- [ ] Pagination or infinite scroll

### 1.4 — Performance History
- [ ] `/library/[orgSlug]/performances` page: list performances
- [ ] `/library/[orgSlug]/performances/new` page: log a new performance
- [ ] Select library entries to add to the program (with ordering)
- [ ] Performance detail view showing the program
- [ ] "Last performed" and "times performed" derived data on catalog entries

### 1.5 — Library CSV Import
- [ ] `/library/[orgSlug]/import` page: import library data from spreadsheets
- [ ] Adapt existing CSV import pipeline for library-specific fields
- [ ] Column mapping for: title, composer, copies, location, condition, parts
- [ ] Reference DB matching: attempt to link imported entries to reference works
- [ ] Duplicate detection within the org's library
- [ ] Import report with row-level results

### 1.6 — Library Entry Comments
- [ ] Comments section on `/library/[orgSlug]/catalog/[id]` page
- [ ] Threaded replies
- [ ] All org roles can read and write comments
- [ ] Author can edit/delete their own comments

### 1.7 — Org Activity Feed
- [ ] `/library/[orgSlug]/activity` page
- [ ] Show audit trail: entry creates/updates/deletes, performance logs, member changes, comments
- [ ] Filter by entity type, action, date range
- [ ] Reuse activity feed component patterns from admin activity page

### 1.8 — Tag Management
- [ ] Tag CRUD within org settings
- [ ] Assign tags to library entries (multi-select)
- [ ] Filter catalog by tag
- [ ] Tag categories (season, genre, difficulty)

---

## Phase 2: Organization Management

Multi-user access and org settings.

### 2.1 — Org Settings Page
- [ ] `/library/[orgSlug]/settings` page
- [ ] Edit org name, type
- [ ] View current plan tier

### 2.2 — Member Management
- [ ] `/library/[orgSlug]/settings/members` page
- [ ] Invite users by email
- [ ] Assign/change roles (owner, manager, member)
- [ ] Remove members
- [ ] Invite acceptance flow

### 2.3 — Personal Library Polish
- [ ] "My Library" branding for auto-created personal orgs (no "organization" language)
- [ ] Simplified settings page for personal orgs (hide member management)
- [ ] Upgrade path: convert personal library to ensemble org (rename, change type, invite members)

---

## Phase 3: Subscription & Billing

Stripe integration for org and individual billing.

### 3.1 — Stripe Setup
- [ ] Stripe product/price configuration
- [ ] Webhook handler for subscription events
- [ ] Update `organization.plan_tier` on subscription changes

### 3.2 — Billing UI
- [ ] Plan selection and checkout flow
- [ ] Stripe Customer Portal link for managing subscription
- [ ] Usage display (members, entries, storage)

### 3.3 — Plan Enforcement
- [ ] Free tier limits (entries, members, storage)
- [ ] Upgrade prompts when approaching limits
- [ ] Graceful degradation (read-only) on expiration

---

## Phase 4: Reference DB Integration (Differentiators)

Features that leverage the reference database as a competitive advantage.

### 4.1 — Auto-Populate Enhancement
- [ ] Smarter matching: fuzzy search, alternate titles, opus numbers
- [ ] Bulk match: scan existing library entries and suggest reference links
- [ ] Show reference DB instrumentation as template for parts entry

### 4.2 — Repertoire Discovery
- [ ] "What can I program for my instrumentation that I haven't performed?"
- [ ] Filter reference works by instrumentation match, difficulty, duration
- [ ] Exclude works already in performance history
- [ ] Subscription upsell feature

### 4.3 — Reference DB Seeding
- [ ] Import Latin American works database (~10K works)
- [ ] Seed standard repertoire (~200-300 most programmed works)
- [ ] Community contribution: library entries can seed reference DB

---

## Phase 5: Enhanced Features

Post-launch differentiators.

### 5.1 — PDF Attachments
- [ ] Supabase Storage bucket for score/part PDFs
- [ ] Upload/download on library entry editor
- [ ] Storage quota per plan tier

### 5.2 — Concert Program Generator
- [ ] Generate printable program from a performance record
- [ ] Pull composer bios, work details from reference DB
- [ ] Customizable templates

### 5.3 — Rental Set Tracking
- [ ] Checkout/return workflow
- [ ] Due dates and overdue alerts
- [ ] Condition notes on return
- [ ] Missing part flagging

### 5.4 — Budget Tracking
- [ ] Cost tracking per library entry (purchase price, rental fee)
- [ ] Per-performance budget rollup
- [ ] Season budget overview

### 5.5 — Mobile Companion (iOS)
- [ ] Quick lookup during rehearsals
- [ ] Barcode/QR scanning for physical catalog
- [ ] Native Swift app (Felix to build)

---

## Open Items (Pre-Build)

- [ ] Export MSO Google Sheet and document actual columns in use
- [ ] Confirm format and fields of Latin American works database (~10K works)
- [ ] Sign up for Archive440 free tier and document UX gaps
- [ ] Decide on product name (keep OpusGraph? Rename?)
- [ ] Deprecate existing subscriber/subscription/team/institution tables after org model is live
