# OpusGraph

Dual-purpose platform: a curated classical music **Works Database** layered with a multi-tenant ensemble library management SaaS. The Works Database auto-populates catalog entries; the library management is the product users pay for.

## Commands

- `npm run dev` — Start dev server (http://localhost:3000)
- `npm run build` — TypeScript check + production build
- `npm run lint` — ESLint (Next.js core-web-vitals + TypeScript rules)
- `npx shadcn@latest add [component]` — Add shadcn/ui components

## Tech Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript 5**
- **Supabase** (PostgreSQL, Auth, RLS) — `@supabase/ssr` for SSR cookie handling
- **shadcn/ui** + **Tailwind CSS 4** + **Radix UI** primitives
- **React Hook Form** + **Zod 4** for form validation
- **Deployed on Vercel** at opusgraph.vercel.app

## Project Structure

### Reference DB Admin (existing)
- `app/admin/` — Protected admin pages (composers, works, activity, review, import, profile)
- `app/api/admin/` — RESTful API routes for CRUD, search, import, review

### Library Management (new)
- `app/library/` — Org-scoped library pages (catalog, performances, settings)
- `app/api/library/` — API routes for library CRUD, import, search, members

### Shared
- `app/api/places/` — Location search (Google Places + Nominatim fallback)
- `app/auth/` — Login, signup, OAuth callback
- `app/composers/`, `app/works/`, `app/search/` — Public-facing pages
- `components/ui/` — shadcn/ui components
- `lib/supabase/` — Three Supabase clients: `server.ts` (server components), `client.ts` (browser), `public.ts` (read-only)
- `lib/validators/` — Zod schemas
- `supabase/migrations/` — Database migrations (apply via Supabase CLI or SQL editor)
- `middleware.ts` — Route protection + auth session refresh

## Two-Layer Auth System

**Layer 1 — Platform Admin** (`user_profile.admin_role`):
- `super_admin`, `admin`, `contributor` — manage the reference database at `/admin/*`
- These are internal roles for data curation, not customer-facing

**Layer 2 — Organization** (`org_member.role`):
- `owner`, `manager`, `member` — customer-facing roles within each org at `/library/[orgSlug]/*`
- Users can belong to multiple orgs with different roles
- Individual users get an auto-created personal org ("My Library") — same code path, no special case
- All org members can comment on library entries; only owner/manager can edit catalog

Billing: orgs billed at org level; personal orgs (individuals) billed individually.

## Architecture & Conventions

- **Path alias**: `@/*` maps to project root
- **Security layers**: middleware route guards + API role checks + database RLS policies
- **Multi-tenancy**: all library data scoped by `organization_id` (NOT NULL — individuals are single-member orgs), enforced via RLS
- **Org context**: URL-based via slug (`/library/[orgSlug]/...`), not cookies
- **Reference ↔ Library**: library entries link to reference works via optional FK; display logic merges reference data with JSONB `overrides` (strict type: title, composer_first_name, composer_last_name, arranger, publisher, instrumentation, duration, year_composed)
- **Audit trail**: unified `revision` table covers both Works Database and library changes; `organization_id` column scopes library audit to the org
- **Comments**: `library_comment` table (threaded, all org roles can read/write) separate from `admin_comment` (platform-internal)
- **Autosave**: Admin editors debounce saves at 800ms
- **Draft/publish workflow**: Reference entities use `status` column (`publication_status` enum: 'draft' | 'published')
- **Supabase clients**: Use `server.ts` in server components/API routes, `client.ts` in client components, `public.ts` for unauthenticated read-only access
- **Force-dynamic**: Auth and admin layouts use `export const dynamic = "force-dynamic"` for Vercel compatibility
- **Migrations**: Sequential naming `XXXX_description.sql` in `supabase/migrations/`

## Key Documentation

- `docs/USER_GUIDE.md` — End-user guide for library management and Works Database admin
- `docs/ARCHITECTURE.md` — System design, data flow, route structure, key decisions
- `docs/SCHEMA.md` — Detailed table specs for all new library management tables
- `claude-code-handoff.md` — Original planning doc with competitive context and priorities
- `ensemble-library-opportunity.md` — Market research and opportunity assessment

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `GOOGLE_PLACES_API_KEY` — Optional, for location search
