# Decisions

Record durable product and architecture decisions here. Keep entries brief and biased toward rationale and consequences.

## 2026-03-20: Catalog creation must be owner-or-manager only at both UI and route levels

- Decision: Treat library-entry creation as an owner/manager capability everywhere, not just at the API layer. Members must not see create affordances and must be redirected away from `/library/[orgSlug]/catalog/new`.
- Context: The live signed-in verification run showed that member users were correctly blocked from some higher-privilege areas but could still see `Add New` affordances and load the full `New Library Entry` page directly, even though the create API path was already guarded.
- Why:
  - create authorization needs to be consistent across page routing, UI affordances, and API handlers
  - hiding only the API boundary leaves confusing and unsafe partial access in the product surface
  - the library-management role model already states that only owners/managers can edit catalog data
- Consequences:
  - verification should explicitly check both direct `/catalog/new` access and create affordance visibility for members
  - future catalog-management features should use the same owner/manager gate at the page and component layer, not just the write endpoint

## 2026-03-20: Harden auth user bootstrap with a pinned search path and schema-qualified slug generation

- Decision: Keep `public.handle_new_user()` as the signup bootstrap trigger, but harden it with `set search_path = public` and `public.generate_slug(...)`, shipped as forward repair migration `0015_fix_handle_new_user_search_path.sql`.
- Context: New-user creation failed in the linked cloud project even with valid modern publishable/secret keys. Live DB inspection showed the `auth.users` trigger path could not resolve unqualified `generate_slug(...)` under the effective search path, which caused `auth.admin.createUser()` to fail with a database error.
- Why:
  - fixes the actual failure boundary without changing the broader signup bootstrap behavior
  - makes the trigger deterministic across auth-trigger execution contexts
  - avoids blaming the modern key migration for a database-function resolution bug
- Consequences:
  - new-user creation now depends on `0015` being present in upgrade environments
  - future auth-trigger functions should either pin `search_path` explicitly or schema-qualify cross-function calls
  - signed-in auth/RLS verification can now use dedicated disposable test accounts instead of existing personal accounts

## 2026-03-19: Parallel agent work should use separate worktrees with explicit file ownership

- Decision: Concurrent agents should use separate `git worktree`s and separate branches, and active file ownership should be recorded in `docs/ACTIVE_CONTEXT.md`.
- Context: Multiple Codex instances may work on OpusGraph concurrently, and simple branch separation inside one checkout does not prevent collisions in uncommitted files, generated artifacts, or overlapping edits.
- Why:
  - a separate worktree isolates the filesystem state for each active coding stream
  - a separate branch keeps integration boundaries explicit
  - recording file ownership in `docs/ACTIVE_CONTEXT.md` makes conflicts visible before edits start
- Consequences:
  - the default safe setup for parallel work is one worktree per agent
  - concurrent edits to the same files should be treated as an exception, not normal workflow
  - `docs/ACTIVE_CONTEXT.md` must be updated when a new parallel stream starts or finishes

## 2026-03-18: Use repo-native docs as the canonical handoff system

- Decision: The canonical documentation workflow for ongoing work is `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/WORKLOG.md`, `docs/ACTIVE_CONTEXT.md`, and focused specs under `docs/specs/`.
- Context: Work will continue across local Codex sessions and Codex Cloud sessions, so resuming from memory or chat history is too fragile.
- Why:
  - keeps the latest handoff state inside the repo
  - gives both humans and agents one place to find what is current, what changed, and what remains
  - separates planning, decisions, and implementation history so docs stay readable
- Consequences:
  - every substantial session needs a doc update
  - `ACTIVE_CONTEXT.md` becomes the first file to read when resuming work

## 2026-03-18: Keep `0014` as the forward repair for the `org_member` RLS fix

- Decision: Preserve `supabase/migrations/0013_fix_org_member_rls.sql` as historical migration history, keep the corrected helper/policy end state in `supabase/migrations/0005_organizations.sql` for fresh installs, and use `supabase/migrations/0014_backfill_org_member_rls_helpers.sql` as the forward repair for databases that may already have applied the older `0013`.
- Context: The repo documents Supabase migrations as ordered artifacts applied via `supabase db push` or the SQL editor, and there is no checked-in proof that `0013` never ran outside local dev.
- Why:
  - avoids migration-history drift if the old `0013` has already been applied anywhere persistent
  - keeps fresh installs correct without depending on a later repair migration
  - matches the existing verification runbook, which already treats `0014` as an upgrade repair for existing databases
- Consequences:
  - `0013` should not be rewritten further without explicit evidence that it never escaped local-only environments
  - upgrade validation should focus on `0014`
  - manual verification and rollout notes should continue to reference `0014` for existing databases

## 2026-03-15: OpusGraph is a dual-purpose platform

- Decision: OpusGraph will combine a curated Works Database with a multi-tenant ensemble library management SaaS.
- Context: The original product was a reference database only; the business opportunity is in the paid library-management layer.
- Why:
  - the reference database strengthens data quality and entry speed for the paid product
  - ensemble libraries have a clearer operational pain point than a standalone catalog
- Consequences:
  - the architecture must support both global reference data and org-scoped customer data
  - documentation, roadmap, and implementation need to distinguish reference features from library features
- Sources: `docs/ARCHITECTURE.md`, `claude-code-handoff.md`, `ensemble-library-opportunity.md`

## 2026-03-15: Multi-tenancy is organization-scoped with no individual-user exception path

- Decision: All customer library data is scoped by `organization_id`, and individual users receive a personal org rather than a separate data model.
- Context: The product must support ensembles and solo users without splitting the code path.
- Why:
  - one tenancy model is simpler to reason about and enforce
  - RLS remains consistent because every library row belongs to an org
- Consequences:
  - auth, routing, and billing all center on organizations
  - personal-library UX is a presentation concern, not a schema exception
- Source: `docs/ARCHITECTURE.md`

## 2026-03-15: Organization context is URL-based

- Decision: Org context lives in the route, using `/library/[orgSlug]/...`, not cookies or implicit session state.
- Context: Users may belong to multiple orgs and need explicit switching.
- Why:
  - URLs are inspectable, shareable, and easier to reason about than hidden state
  - this adds a clear defense-in-depth layer alongside RLS
- Consequences:
  - route guards and page loaders must validate org membership
  - active-org switching is a navigation concern
- Source: `docs/ARCHITECTURE.md`

## 2026-03-15: Library entries inherit reference data via optional FK plus strict overrides

- Decision: Library entries optionally reference a work and merge display data with a strict `overrides` JSONB object.
- Context: Customers need local customization without copying the full reference record.
- Why:
  - avoids duplicating reference data
  - supports standalone entries for works not yet in the reference database
- Consequences:
  - application display helpers must resolve reference plus override data consistently
  - editor and API validation must keep override fields tightly typed
- Sources: `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`
