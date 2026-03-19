# Studio Kernel Extraction Map

## Purpose

Map the current OpusGraph codebase into three buckets:
- `shared now`
- `shared later`
- `never shared`

This is not a package split plan yet. It is a decision aid for future extraction work.

The standard is simple:
- `shared now` means the abstraction is already generic enough to justify extraction soon
- `shared later` means it may become shared after another product proves the same shape
- `never shared` means it is meaningfully OpusGraph domain logic and should stay product-bound

## Shared Now

These are the strongest current candidates for a future studio kernel.

### 1. Authentication and access primitives

Relevant files:
- `lib/auth.ts`
- `app/auth/callback/route.ts`
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `middleware.ts`

Why:
- these implement generic auth flow behavior, not music-domain behavior
- redirect preservation, auth gating, and role-aware fallback behavior are reusable across products
- the recent auth redirect work hardened real edge cases that a second product would also hit

Extraction target:
- auth helpers
- safe redirect parsing
- login/signup/callback flow patterns
- route-guard utilities

### 2. Organization and membership model

Relevant files:
- `lib/org.ts`
- `lib/validators/organization.ts`
- `supabase/migrations/0005_organizations.sql`
- `supabase/migrations/0013_fix_org_member_rls.sql`
- `supabase/migrations/0014_backfill_org_member_rls_helpers.sql`

Why:
- org-scoped multi-tenancy is one of the cleanest cross-product primitives in the codebase
- personal-org support is especially valuable for a small studio serving both solo operators and teams
- membership helpers and role checks are generic enough to travel

Extraction target:
- `organization`
- `org_member`
- role vocabulary
- org context resolution
- membership/RLS helper pattern

### 3. Supabase server/client boundary

Relevant files:
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/public.ts`
- `lib/supabase/admin.ts`

Why:
- this is infrastructure glue, not domain logic
- every new product built on the same stack will need a stable server/client/admin boundary
- the cookie handling and SSR pattern are already generic

Extraction target:
- platform data-access adapters
- environment-aware client creation
- server/admin/public access patterns

### 4. Admin and internal operations pattern

Relevant files:
- `app/admin/layout.tsx`
- `components/admin-sidebar.tsx`
- `app/admin/page.tsx`
- `app/admin/activity/page.tsx`
- `app/admin/review/page.tsx`
- `app/admin/import/page.tsx`

Why:
- the current admin area mixes product-specific screens with reusable internal-ops patterns
- the reusable part is not “composer review” or “works import”
- the reusable part is internal admin navigation, audit visibility, review queues, and operations surface conventions

Extraction target:
- internal admin shell
- review queue pattern
- internal activity feed pattern
- admin access boundary

### 5. Audit / event conventions

Relevant files:
- `docs/ARCHITECTURE.md`
- `docs/SCHEMA.md`
- `supabase/migrations/0012_audit_extension.sql`
- activity-related admin and library pages

Why:
- the exact event shapes may evolve, but actor/entity/action/audit patterns are studio-wide concerns
- auditability, moderation, support, and analytics all benefit from shared event conventions

Extraction target:
- event naming conventions
- revision/audit primitives
- actor/entity/action vocabulary

### 6. Shared UI system primitives

Relevant files:
- `components/ui/*`

Why:
- the base UI primitives are already generic and reusable
- this is not the same as forcing all products into the same design language
- the primitive layer can be shared while product presentation remains distinct

Extraction target:
- design-system primitives
- layout and interaction components
- product-agnostic visual foundation

## Shared Later

These are plausible candidates, but not ready for extraction yet.

### 1. Import and ingestion patterns

Relevant files:
- `app/admin/import/csv-import.tsx`
- library import APIs and pages
- migration and import-related routes

Why not now:
- import orchestration may become shared
- mapping rules, validation semantics, and entity resolution are still highly product-shaped

Possible future extraction:
- ingestion queue primitives
- job status tracking
- import-session scaffolding

### 2. Search infrastructure

Relevant files:
- `app/search/*`
- `app/api/public/search`
- `supabase/migrations/0003_search_indexes.sql`
- `supabase/migrations/0008_library_search.sql`

Why not now:
- indexing and search infra may be reusable
- search object model, ranking, filters, and taxonomy are domain-specific today

Possible future extraction:
- search service boundary
- index update pipeline
- generic query telemetry

### 3. Tagging and taxonomy framework

Relevant files:
- `lib/validators/library-tag.ts`
- `app/library/[orgSlug]/tags/*`
- `supabase/migrations/0009_library_tags.sql`

Why not now:
- tags feel generic, but their semantics are usually domain language
- another product might need labels, categories, or facets with very different behavior

Possible future extraction:
- lightweight labeling primitive only if two products converge

### 4. Comments and collaboration primitives

Relevant files:
- `lib/validators/library-comment.ts`
- `supabase/migrations/0010_library_comments.sql`
- library comment API/routes

Why not now:
- comments often look universal but authorization, threading, visibility, and notification rules vary by product

Possible future extraction:
- discussion-thread primitives after a second product proves the same interaction model

### 5. Saved views, alerts, subscriptions

Relevant files:
- not yet formalized as a first-class system in this repo

Why not now:
- this is conceptually attractive for a studio kernel
- it should not exist as a shared abstraction until at least two products need persistent filters or watchlists in similar ways

## Never Shared

These are clearly OpusGraph domain logic.

### 1. Classical music reference domain

Relevant files:
- `lib/validators/composer.ts`
- `lib/validators/work.ts`
- composer/work pages and APIs
- reference-data migrations

Why:
- this is the product’s proprietary domain
- it has no reason to be in a studio kernel

### 2. Library-entry domain model

Relevant files:
- `lib/library.ts`
- `lib/validators/library-entry.ts`
- `lib/validators/performance.ts`
- library pages and APIs
- `supabase/migrations/0006_library_entries.sql`
- `supabase/migrations/0007_performances.sql`

Why:
- this is music-library workflow logic
- the override/reference merge model is specific to OpusGraph
- even if another product has “records with overrides,” the semantics here are too domain-shaped

### 3. Classical-music search semantics

Relevant files:
- public search pages and APIs
- library search pages and APIs

Why:
- the infra might later be shared
- the semantics should stay with the product

### 4. Domain-specific editorial and moderation logic

Relevant files:
- works/composers review and merge flows
- reference import semantics

Why:
- moderation patterns can be shared later
- the current editorial rules are OpusGraph-specific

## First Extraction Targets

If future work intentionally improves extraction readiness, focus here first:

### Target 1: `orgs`

Start from:
- `lib/org.ts`
- `lib/validators/organization.ts`
- org-related migrations

Desired shape:
- shared org context resolver
- shared membership/role vocabulary
- shared personal-org support

### Target 2: `auth-access`

Start from:
- `lib/auth.ts`
- `lib/auth-redirect.ts`
- auth route files
- `middleware.ts`

Desired shape:
- shared auth flow helpers
- safe redirect utilities
- role-aware route guard patterns

### Target 3: `platform-data`

Start from:
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/public.ts`
- `lib/supabase/admin.ts`

Desired shape:
- one reusable data-access layer for products on the same stack

### Target 4: `admin-ops`

Start from:
- admin shell/layout/sidebar
- activity and review conventions

Desired shape:
- shared internal operations shell
- supportable audit/review patterns

### Target 5: `events`

Start from:
- revision/audit patterns
- activity feed structure

Desired shape:
- consistent cross-product event vocabulary

## Practical Guidance For Future Work

When editing OpusGraph, use this decision rule:

### Make it extraction-friendly when:

- the logic is clearly org/auth/billing/admin/audit infrastructure
- another product would plausibly want the same rules
- the abstraction can be named without music-domain vocabulary

### Keep it product-shaped when:

- the abstraction only makes sense in classical-music terms
- the data model depends on reference-work/library-entry semantics
- a shared name would hide real product differences

## Current Recommendation

Do not extract code yet.

Instead:
- keep shipping OpusGraph
- improve boundaries around auth, orgs, audit, and platform access
- use the second product to validate which abstractions deserve real extraction

The right next move after this map is not a rewrite.
It is a small inventory of modules that should be kept clean and generic as OpusGraph evolves.
