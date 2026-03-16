# Claude Code Handoff: OpusGraph → Ensemble Library Management SaaS

**Date:** March 15, 2026
**Author:** Felix Torres | Wright Torres Group LLC
**Purpose:** Context transfer from research/planning (Claude.ai) to implementation (Claude Code)

---

## What We're Building

A cloud-based SaaS platform for ensemble music library management. The product replaces spreadsheets used by orchestras, choirs, bands, and other performing ensembles to catalog sheet music, track parts and copies, manage performance history, and plan seasons.

**Primary user:** Community orchestra music directors and volunteer librarians.
**First customer:** Mesquite Symphony Orchestra (MSO), where Felix holds an artistic/programming leadership role.
**Business model:** Freemium SaaS, $9-14/mo paid tiers (aligned with Archive440 pricing).

---

## Starting Point: OpusGraph

This is NOT a greenfield build. We are pivoting an existing codebase called **OpusGraph**, originally built as an orchestral work reference database (a competitor to Daniels' Orchestral Music catalog).

### Current OpusGraph State

- **Stack:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Supabase
- **What exists:** Basic work entity model, search functionality, API layer (designed for agent-based data entry)
- **Data:** ~5-10 works populated. The schema and search are the valuable parts, not the data.
- **APIs:** Built out so an AI agent could add works programmatically. This becomes the bulk import / CSV import path.

### What Needs to Change

OpusGraph's current schema likely has: composer, title, instrumentation, publisher, duration, and similar reference fields.

**Add for library management (P0):**
- `copies_owned` — integer, how many copies/sets the org owns
- `parts_detail` — what specific parts exist (e.g., "Fl 1, Fl 2, Ob 1, Ob 2..." or "SATB")
- `location` — shelf/cabinet/room identifier
- `condition` — free text or enum (good, fair, poor, missing parts)
- `performance_history` — related table: date, event name, venue, notes
- `tags` — many-to-many: season, genre, difficulty, liturgical season, etc.
- `notes` — free text per catalog entry
- `organization_id` — multi-tenant: each org sees only their library

**Add for multi-tenancy (P0-P1):**
- Organization model with Supabase RLS
- User roles: admin, librarian, member (read-only)
- Invite flow for adding users to an org

**Keep and enhance:**
- The existing search/filter system — this is the core value prop
- The existing work reference data model — this becomes the "reference database" layer
- The API layer — this becomes CSV import and future integrations

### Strategic Architecture Decision

The reference database (OpusGraph's original purpose) becomes a **differentiator within the library tool**, not a separate product:

1. **Auto-populate on catalog entry** — User types "Beethoven Symphony No. 5" and the system suggests a match from the reference DB, auto-filling instrumentation, duration, publisher. This is the MVP integration. Free for all users.
2. **Repertoire discovery (future)** — "Show me works for my exact instrumentation that I haven't performed." Subscription upsell.
3. **Full reference browsing (future)** — The Daniels competitor as a feature within the product.

The reference DB should be a separate schema/table from the user's library. A library entry can optionally link to a reference work, but users can also catalog works that don't exist in the reference DB (and those entries can seed the reference DB over time).

---

## Competitive Context

### Only Real Competitor: Archive440

- Cloud SaaS for sheet music cataloging, performance tracking, budgeting
- Pricing: Free (Largo), $9/mo (Andante, 10 users), $14/mo (Allegro, unlimited users)
- Features: instrumentation tracking, performance history, budgeting, wishlists, PDF uploads, CSV import
- Weaknesses: typo-riddled marketing ("disigned," "instermentation," "Catagories"), small team, limited discoverability, no mobile app, no community features, no reference database integration
- **Key gap we exploit:** No auto-populated work metadata. No reference database. No repertoire discovery. Users must manually enter every field for every work.

### The Real Incumbent: Google Sheets / Excel

- Used by the vast majority of ensembles, including MSO (Google Sheet)
- The migration path must be frictionless: CSV import is P0

---

## Data Assets

### MSO Library (Google Sheet)
- Felix will export the MSO Google Sheet and analyze the actual columns/fields in use
- This becomes the real-world schema validation — build to match what they actually track, not what we theorize
- **Action needed before coding:** Felix exports the sheet, documents the columns, identifies gaps

### Latin American Works Database (~10,000 works)
- Built by Felix's former teacher
- Previously behind a paid database, now offered free of charge
- Covers Latin American and Caribbean composers — directly aligned with Resonance Music Press identity
- This seeds the reference database with a unique collection no competitor has
- **Format TBD** — Felix needs to confirm what format this data is in and what fields it contains

### Standard Repertoire Seeding
- The ~200-300 most commonly programmed orchestral works should be seeded into the reference DB
- Sources: IMSLP metadata, public domain catalogs, manual entry via the existing API
- This provides the auto-populate experience for the works most early users will catalog

---

## Feature Priorities

### P0 — MVP (Build for MSO dogfooding)

| Feature | Notes |
|---------|-------|
| Catalog entry: title, composer, arranger, publisher, instrumentation/voicing | Core entity. Extend from OpusGraph's existing work model. |
| Copy/part count tracking per piece | Most-cited missing feature from spreadsheets. |
| Multi-field search and filtering | **Already partially built in OpusGraph.** The #1 reason spreadsheets fail. |
| Performance history (date, event, pieces performed) | Season planning depends on this. Related table. |
| CSV/spreadsheet import | Migration path from Google Sheets. Use existing API layer. |
| Single-org setup (MSO) | Multi-tenant architecture from day one, but only MSO as first org. |

### P1 — Pre-launch

| Feature | Notes |
|---------|-------|
| Category/tag system (season, genre, difficulty) | Important for churches (liturgical season) and schools (difficulty). |
| PDF upload and attachment | Attach scanned scores or parts to catalog entries. Supabase Storage. |
| Multi-user access with roles | Admin, librarian, read-only member. Supabase Auth + RLS. |
| Reference DB auto-populate | Type-ahead search that matches against reference works and fills fields. |

### P2 — Post-launch differentiators

| Feature | Notes |
|---------|-------|
| Rental set tracking | Checkout/return workflow, condition notes, missing part alerts. |
| Concert program generator | Pull from catalog to auto-generate program notes. |
| Repertoire discovery | "What can I program for my instrumentation that I haven't done?" |
| Budget tracking per performance | Cost of purchased music, rental fees, licensing. |
| Mobile companion (iOS) | Quick lookup during rehearsals. Felix can build native Swift. |

---

## Validated Pain Points (from real forum posts and community discussions)

These are the problems real users describe. Build to solve these specifically:

1. **Spreadsheets are universal and universally inadequate.** Every ensemble defaults to Excel/Sheets. They work for ~50 items and break at scale. One church described their Excel file as a "temporary solution" that became permanent after 5+ years.

2. **Multi-faceted search is the core unmet need.** Directors want to search simultaneously by voicing + composer + season + instrumentation + number of copies + accompaniment type. "What do we have for SATB with organ that works for Advent and has 50+ copies?" — no spreadsheet handles this.

3. **Performance history tracking is desired but nonexistent.** "When was this last performed?" and "How many times have we used this?" are answered by memory or not at all. Season planning requires knowing what's been done recently.

4. **Copy/part tracking is manual and error-prone.** "We own 52 copies of this piece, 3 are missing, last performed Easter 2024" — tracked on paper or not at all.

5. **Physical organization is chaotic.** Directors inherit rooms of mildew and scattered boxes. A digital catalog with location tracking solves "where is this physically?"

---

## Market Context (for prioritization decisions)

- **U.S. market:** ~270,000 ensembles (church choirs, school choruses, community choruses, orchestras, bands)
- **International:** ~385,000+ globally. Germany (61K+), UK (41K+) are largest international markets.
- **Revenue ceiling:** U.S.-only base case ~$42K ARR; with internationalization ~$150-460K ARR
- **Expansion sequence:** U.S. community orchestras → U.S. community choruses → UK → Germany → rest
- **This is a lifestyle/small business opportunity, not venture-scale.** Build lean.

---

## Technical Recommendations

### Keep from OpusGraph
- Supabase project (auth, database, storage, RLS)
- Next.js app structure
- Search/filter components and logic
- API routes for programmatic data entry
- shadcn/ui component library

### Add
- Multi-tenant org model with Supabase RLS policies
- Performance history table (org_id, work_id, date, event_name, venue, notes)
- Tags/categories system (many-to-many)
- CSV import pipeline (map spreadsheet columns to schema)
- Reference works table (separate from library entries, linkable)
- File attachments via Supabase Storage (PDFs of scores/parts)

### Architecture Pattern
```
reference_works (global, read-only for users)
  ├── id, title, composer, arranger, instrumentation, duration, publisher, etc.
  
library_entries (per-org, user-managed)
  ├── id, org_id, reference_work_id (nullable FK), 
  ├── title, composer, arranger, publisher, instrumentation (can override reference)
  ├── copies_owned, parts_detail, location, condition, notes
  ├── tags (many-to-many)
  └── created_by, updated_at

performances (per-org)
  ├── id, org_id, date, event_name, venue, notes
  └── performance_works (join: performance_id, library_entry_id)

organizations
  ├── id, name, type (orchestra|choir|band|church), plan_tier

org_members
  ├── org_id, user_id, role (admin|librarian|member)
```

### First Session Priorities for Claude Code
1. Review the existing OpusGraph codebase structure
2. Design and implement the schema migration (add library management tables)
3. Build the CSV import pipeline (this unblocks dogfooding with MSO data)
4. Extend the existing search UI to filter on library-specific fields

---

## Open Items (Felix to resolve before/during build)

- [ ] Export MSO Google Sheet and document actual columns in use
- [ ] Confirm format and fields of the Latin American works database (~10K works)
- [ ] Sign up for Archive440 free tier and document UX gaps
- [ ] Decide on product name (keep OpusGraph? Rename?)
- [ ] Confirm Supabase project details (existing project? new project?)

---

## Reference Documents

- **Full opportunity assessment:** `ensemble-library-opportunity.md` (market sizing, competitive landscape, international analysis, risks, next steps)
- **OpusGraph codebase:** [Felix to provide repo location]

---

*This document was prepared from a research session on Claude.ai on March 15, 2026. The full conversation covered idea validation methodology, competitive analysis, market sizing (U.S. and international), pain point validation from real forum posts, and the strategic decision to pivot OpusGraph into the library management product.*
