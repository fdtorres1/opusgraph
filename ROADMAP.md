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

## ✅ Phase 0: Foundation (Completed)

Multi-tenant infrastructure — schema, auth, and middleware.

- [x] 7 database migrations (0005–0011): organizations, library entries, performances, search index, tags, comments, audit trail
- [x] RLS policies on all new tables with org-scoped isolation
- [x] Middleware protection for `/library/*` routes
- [x] Org auth helpers: `getOrgContext()`, `requireOrgRole()`
- [x] Zod validators for all library entities
- [x] Library display utility functions (`resolveEntryDisplay()`, condition helpers)

---

## ✅ Phase 1: MVP Library Management (Completed)

Built for MSO dogfooding — core CRUD, search, and all library features.

- [x] Library dashboard with stats, quick actions, recent items
- [x] Library entry editor with autosave, reference work lookup, parts management, tags, comments
- [x] Catalog browse & search with full-text search, condition/tag filters, sorting, pagination
- [x] Performance history with program builder (add works, reorder, autosave)
- [x] CSV import wizard (5-step: upload, map, validate, execute, results)
- [x] Threaded comments on library entries (all org roles can comment)
- [x] Org activity feed with filters and pagination
- [x] Tag management with color picker and entry counts

---

## ✅ Phase 2: Organization Management (Completed)

Multi-user access, org settings, and personal library polish.

- [x] Org settings page (edit name/type, plan display, delete org)
- [x] Member management (invite by email, change roles, remove members)
- [x] Personal library polish (login redirects, root `/` redirect, sidebar branding)
- [x] Service-role Supabase client for email-based user lookup

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
