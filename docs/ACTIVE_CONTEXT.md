# Active Context

This is the canonical handoff file for the next session. Rewrite freely as priorities change.

## Current Objective

Continue the generic source-ingestion foundation with the first real IMSLP adapter slice now that `T4-1` through `T4-4` and `T5-1` through `T5-3` are merged on `main` and the current branch is wiring a composer-only `imslp` adapter into the new ingest APIs.

## Current Branch

- `feat/imslp-composer-adapter`

## Parallel Work Coordination

### Coordination Rules

- Use a separate `git worktree` for each active agent or coding stream.
- Use a separate branch per worktree.
- Do not let two active agents make code edits from the same worktree.
- Do not let two active agents own the same files at the same time.
- Before starting substantial work, add or update an entry in `Active Workstreams`.
- Before ending a session, update the matching workstream entry or remove it if the work is complete.

### Active Workstreams

- Agent: current Codex session
  - Worktree: current checkout at `/Volumes/Felix-SSD-1/Cursor Projects/opusgraph`
  - Branch: `feat/imslp-composer-adapter`
  - Scope: implement the first real IMSLP composer adapter, move the adapter registry out of the route layer, and document the next move into end-to-end dry-run verification
  - File ownership:
    - `docs/ACTIVE_CONTEXT.md`
    - `app/api/admin/ingest/_shared.ts`
    - `app/api/admin/ingest/jobs/route.ts`
    - `app/api/admin/ingest/jobs/[id]/run/route.ts`
    - `lib/ingest/adapters/index.ts`
    - `lib/ingest/adapters/imslp/constants.ts`
    - `lib/ingest/adapters/imslp/client.ts`
    - `lib/ingest/adapters/imslp/parser.ts`
    - `lib/ingest/adapters/imslp/mapper.ts`
    - `lib/ingest/adapters/imslp/index.ts`
    - `lib/ingest/index.ts`
    - `docs/WORKLOG.md`
    - `docs/ROADMAP.md`
  - Status: active
  - Notes: auth/RLS is already signed off; the manual backup requirement remains in force for future linked-cloud migrations; `0016` is applied in the linked cloud; `T4` and `T5` are merged on `main`; the current task slice is the first IMSLP composer adapter

## In Progress

- Middleware now preserves the full internal path plus query string when redirecting unauthenticated users to `/auth/login`.
- Login and signup now use `redirect` as the canonical auth redirect parameter.
- Auth callback handling now parses redirects through a shared helper, honors only safe internal paths, and accepts legacy `next` only as a backward-compatibility fallback.
- Fresh-install bootstrap logic in `0005_organizations.sql` now carries the corrected `security definer` helper and policy end state.
- `0014_backfill_org_member_rls_helpers.sql` is the chosen forward repair for existing databases that may already have applied the older `0013` fix.
- `0015_fix_handle_new_user_search_path.sql` is now the forward repair for the auth bootstrap trigger, pinning `search_path = public` and schema-qualifying `public.generate_slug(...)` inside `handle_new_user()`.
- Static verification is complete: `npm run build` passes, and targeted lint passes for the touched auth/middleware files.
- Linked cloud verification shows the active Supabase project is `vszoxfmjkasnjpzieyyd`, and `0014` has now been applied successfully.
- Hosted verification confirms the deployed hotfix is live: logged-out library and admin redirects now preserve the correct `redirect` target on `opusgraph.vercel.app`.
- Hosted login and signup pages preserve the redirect parameter in their cross-links.
- Manual verification guidance exists in `docs/AUTH_AND_RLS_VERIFICATION.md`, and the reusable checklist now lives in `docs/templates/auth-rls-verification-checklist.md`.
- The modern `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` are verified valid; the earlier user-creation failure was traced to the `handle_new_user()` trigger, not to credential or app misconfiguration.
- Production was temporarily serving a legacy Supabase anon key in the hosted browser bundle, which caused `Legacy API keys are disabled` during login; the production env/config was corrected and owner login now works again with the modern publishable key.
- Dedicated cloud verification fixtures now exist:
  - org `auth-rls-verification-20260320` (`6228fd52-3a52-49b1-a3fa-50d8bf3a4d00`)
  - `auth-rls-owner-20260320@example.com`
  - `auth-rls-manager-20260320@example.com`
  - `auth-rls-member-20260320@example.com`
  - `auth-rls-outsider-20260320@example.com`
- The temporary verification-org memberships for the two Felix accounts were removed after the dedicated test users were created.
- Signed-in verification findings so far:
  - owner login returns correctly to `/library/auth-rls-verification-20260320/catalog?view=all`
  - outsider auth from `/admin/review` falls back to the outsider's own library instead of `/admin/*`
  - outsider direct access to the verification org falls back to the outsider's own library
  - member can read the org catalog and settings members page
  - member is denied from `/library/auth-rls-verification-20260320/tags`
- The member catalog-create defect has now been fixed and revalidated in production:
  - member login from `/catalog/new` now lands on `/catalog`
  - members no longer see catalog-create affordances
  - manager and owner still reach `/catalog/new`
- Live `org_member` RLS checks using real user JWTs against `rest/v1` now confirm:
  - `owner`, `manager`, and `member` each read the verification-org membership rows
  - `outsider` reads zero rows
  - `member` insert is denied
  - `manager` insert succeeds
  - `owner` update/delete succeeds
  - `manager` update/delete noop because the row is not writable/visible under policy
  - outsider cleanup was confirmed after mutation checks
- Admin-generated signup confirmation has now been exercised directly against the live Supabase verify endpoint:
  - Supabase verification preserves the canonical `redirect` target back to `/auth/callback`
  - the live flow currently lands on `/auth/login?error=auth_callback_error&redirect=%2Flibrary%2Fauth-rls-verification-20260320%2Fcatalog`
  - the current callback route only handles `code` exchange and does not handle the email-confirmation token shape returned by the signup verification flow
- A new server-side confirmation flow is now implemented locally:
  - `/auth/confirm` verifies `token_hash` + `type` with `verifyOtp(...)`
  - `/auth/callback` now remains the `?code=...` path
  - post-auth redirect policy is shared in `lib/post-auth-redirect.ts`
  - safe redirect parsing now also supports same-origin `redirect_to` URLs
- The server-side signup confirmation flow is now merged and deployed:
  - PR #23 merged to `main`
  - production `/auth/confirm` is live
  - the hosted Supabase Confirm signup template now points at `/auth/confirm?token_hash=...&type=email&redirect_to={{ .RedirectTo }}`
- Production end-to-end signup confirmation now passes:
  - a fresh production `token_hash` sets the session cookie on `/auth/confirm`
  - the flow first redirects to the requested verification-org catalog
  - downstream org access rules correctly fall the new outsider user back to their personal library
- Final production auth/RLS signoff checks now pass:
  - a real platform-admin login from `/admin/review` returns to `/admin/review`
  - a non-admin login from `/admin/review` still falls back to the user's personal library
  - owner login from `/library/auth-rls-verification-20260320/catalog?view=all` still returns to the requested route
  - auth/RLS verification is now complete and no longer the active implementation blocker
- IMSLP ingestion planning review is complete:
  - the current reference import pipeline is CSV-only
  - admin CRUD, duplicate review, `external_ids`, `extra_metadata`, `review_flag`, and `revision` provide reusable building blocks
  - IMSLP exposes a documented bulk list API for people and works plus usable MediaWiki `api.php` endpoints for page metadata and wikitext
  - the plan has been revised so the target architecture is a generic source-ingestion framework with IMSLP as the first adapter
  - the spec is now decomposed into smallest-unit execution tasks with task IDs `T0-*` through `T12-*`, explicit dependencies, and a recommended first-10-task sequence
  - a focused spec now exists at `docs/specs/imslp-reference-ingestion.md`
- IMSLP-grounded `T0-1` through `T0-4` decisions are now codified in the spec:
  - use canonical resolved IMSLP page title + URL as durable source identity rather than raw list `pageid`
  - keep a simple six-state ingest job lifecycle
  - use a structured JSON cursor that maps IMSLP `start` into a generic offset model
  - define dry-run as full fetch/parse/match simulation without any composer/work/review writes
- `T1-1` is now in flight:
- `T1-1` is now merged:
  - `0016_source_ingest_job.sql` introduces a queue-ready ingestion job control-plane table
  - the migration uses the existing `entity_kind` enum, new job status/mode enums, JSONB cursor/options/summaries, execution counters, retry fields, claim/heartbeat fields, and `updated_at` trigger support
- `T1-1` is now applied to the linked Supabase cloud project:
  - a fresh manual logical backup was verified first at `/Users/felixtorres/backups/opusgraph-20260324-110603.dump`
  - the old remote-only `0002` migration-history mismatch was repaired with `supabase migration repair --status reverted 0002`
  - `supabase db push --linked --include-all` then replayed the harmless `0002_add_activity_view_rls.sql` comment migration and applied `0016_source_ingest_job.sql`
  - post-apply verification confirmed the new enums, `source_ingest_job` table, and `trg_source_ingest_job_updated_at` trigger exist in the linked cloud database
- `T2-1` through `T2-4` are now implemented locally under `lib/ingest/`:
  - `lib/ingest/domain.ts` defines generic job/domain contracts:
    - source key
    - ingest entity kind
    - job status and mode
    - structured cursor
    - job input
    - execution summary
    - dry-run result
  - `lib/ingest/candidates.ts` defines normalized candidate contracts:
    - source identity
    - raw payload
    - candidate warnings
    - `ComposerCandidate`
    - `WorkCandidate`
  - `lib/ingest/adapters/types.ts` defines the first adapter contract:
    - job-option validation
    - batch fetch
    - batch parse
    - normalized candidate batch
  - `lib/ingest/results.ts` defines normalized persistence-result outcomes:
    - `created`
    - `updated`
    - `skipped_existing_source_match`
    - `flagged_duplicate`
    - `failed_parse`
    - `failed_write`
  - `lib/ingest/index.ts` exports the new type surface
  - `npm run build` passes after the new ingest type layer was added
- `T3-1` through `T3-4` are now implemented locally under `lib/ingest/persist/`:
  - `source-identity.ts` adds generic source-identity matching against `external_ids` for `composer` and `work`
  - `duplicate.ts` wraps source-match and fuzzy duplicate assessment around the existing duplicate RPC concepts and review-flag payload shape
  - `support.ts` centralizes small persistence helpers for:
    - source metadata merge
    - duplicate review-flag creation
    - revision insertion
    - ordered URL normalization
  - `composer.ts` adds the composer persistence service:
    - source-match handling
    - duplicate flagging
    - `composer` row create/update
    - `composer_nationality` replacement
    - `composer_link` replacement
    - provenance writes to `external_ids` / `extra_metadata`
  - `work.ts` adds the work persistence service:
    - source-match handling
    - duplicate flagging
    - `work` row create/update
    - publisher resolution by name
    - `work_source` replacement
    - `work_recording` replacement with provider detection
    - provenance writes to `external_ids` / `extra_metadata`
  - `lib/ingest/index.ts` now exports the persistence layer
  - `npm run build` passes after the persistence helpers were added
- `T4-1` through `T4-4` are now merged under `lib/ingest/jobs/`:
  - `lib/ingest/jobs/types.ts` defines the shared job-service contract:
    - job row mapping
    - service result envelopes
    - adapter registry contract
    - candidate processor hook
  - `lib/ingest/jobs/create.ts` adds job creation with validation for:
    - source
    - entity kind
    - mode
    - createdBy
    - dryRun
    - priority
    - batch size
    - limit count
    - cursor/options object shape
    - adapter-backed option validation
  - `lib/ingest/jobs/load.ts` adds job loading with owner-or-global access enforcement
  - `lib/ingest/jobs/transitions.ts` centralizes allowed status transitions for:
    - pending
    - running
    - paused
    - completed
    - failed
    - canceled
  - `lib/ingest/jobs/run.ts` adds the first single-batch runner:
    - load job
    - validate adapter lookup
    - transition to `running`
    - fetch one batch
    - parse candidates
    - execute dry-run or persistence through an injected candidate processor
    - update counters, cursor, heartbeat, summaries, and terminal/paused status
  - `lib/ingest/jobs/index.ts` exports the job service layer
  - `lib/ingest/index.ts` now exports the jobs layer
  - `npm run build` passes after the job-service layer was added
- `T5-1` through `T5-3` are now implemented locally under `app/api/admin/ingest/`:
  - `app/api/admin/ingest/_shared.ts` adds thin admin-route support for:
    - contributor-plus admin gating
    - normalized issue-to-HTTP mapping
    - route-time candidate processing
    - a placeholder adapter registry for future source wiring
  - `lib/validators/ingest-job.ts` adds request validation for:
    - job id params
    - job creation body
    - single-batch run body
  - `app/api/admin/ingest/jobs/route.ts` adds `POST /api/admin/ingest/jobs`
  - `app/api/admin/ingest/jobs/[id]/route.ts` adds `GET /api/admin/ingest/jobs/[id]`
  - `app/api/admin/ingest/jobs/[id]/run/route.ts` adds `POST /api/admin/ingest/jobs/[id]/run`
  - `npm run build` passes after the new admin ingest routes were added
- The first IMSLP adapter slice is now implemented locally on `feat/imslp-composer-adapter`:
  - `lib/ingest/adapters/index.ts` now owns the real adapter registry
  - `lib/ingest/adapters/imslp/` now contains:
    - `constants.ts`
    - `client.ts`
    - `parser.ts`
    - `mapper.ts`
    - `index.ts`
  - the current adapter supports only IMSLP `type=1` composer/person list ingestion
  - `app/api/admin/ingest/jobs/route.ts` now rejects `source: "imslp"` with `entityKind: "work"` until the work adapter exists
  - `app/api/admin/ingest/jobs/[id]/run/route.ts` now imports the registry from `lib/ingest/adapters`
  - live verification confirmed the documented slash-delimited IMSLP list API shape
  - adapter sanity check now succeeds locally:
    - 5 raw rows fetched successfully
    - a valid next offset cursor is returned
    - parsed composer candidates and warning issues are produced from the batch
  - local linked-cloud dry-run verification now succeeds through the real job services with the existing platform-admin actor:
    - a 5-row dry-run proved the stricter classifier now rejects the initial junk rows instead of emitting fake composers
    - a 25-row dry-run created a real `source_ingest_job` row and produced 8 dry-run composer candidates with a paused next-cursor state at offset 25
    - current first-batch warning mix is still noisy but now explicitly categorized:
      - `imslp_type1_non_composer_row`
      - `imslp_type1_invalid_name_parts`
      - `imslp_type1_unusual_name_format`
  - follow-up review fixes are now in place locally:
    - the generic job runner now marks a batch `failed` if fetch/parse returns any `error`-severity issue instead of silently completing on an empty `nextCursor`
    - IMSLP negation keywords now match tokenized words instead of raw substrings, avoiding false negatives on legitimate names containing fragments like `band` or `trio`
  - `npm run build` passes after the adapter wiring was added
- Current backup/recovery constraint:
  - Supabase-managed backups/PITR are not enabled for the OpusGraph project right now
  - manual logical backup is the current safety path before linked-cloud schema changes
  - the direct database host is IPv6-only and does not work from the home network
  - the direct `pg_dump` path does work when the machine is on the phone hotspot/mobile network
  - latest successful manual backup artifact:
    - `/Users/felixtorres/backups/opusgraph-20260324-110603.dump`

## Next 3 Steps

1. Review whether the current IMSLP `type=1` composer classifier still needs another tightening pass after the successful 25-row dry-run.
2. Decide whether the next slice should be richer composer enrichment or first work-ingestion support.
3. Open the PR for `feat/imslp-composer-adapter` once the current verification notes are acceptable.

## Known Blockers

- This session has no local `.env` file and no running local Supabase stack, so the cloud environment remains the practical verification target.
- IMSLP implementation still depends on staying disciplined about the generic adapter boundary so the first IMSLP slice does not collapse back into a one-off importer.
- Home-network IPv6 routing does not currently reach the Supabase direct DB host, so manual logical backups from this machine require the phone/mobile network until the network issue is fixed.

## Key Files

- `middleware.ts`
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/callback/route.ts`
- `app/auth/confirm/route.ts`
- `lib/auth-redirect.ts`
- `lib/post-auth-redirect.ts`
- `lib/ingest/domain.ts`
- `lib/ingest/candidates.ts`
- `lib/ingest/adapters/types.ts`
- `lib/ingest/index.ts`
- `lib/ingest/jobs/types.ts`
- `lib/ingest/jobs/create.ts`
- `lib/ingest/jobs/load.ts`
- `lib/ingest/jobs/transitions.ts`
- `lib/ingest/jobs/run.ts`
- `lib/ingest/jobs/index.ts`
- `app/api/admin/ingest/_shared.ts`
- `app/api/admin/ingest/jobs/route.ts`
- `app/api/admin/ingest/jobs/[id]/route.ts`
- `app/api/admin/ingest/jobs/[id]/run/route.ts`
- `lib/validators/ingest-job.ts`
- `lib/ingest/results.ts`
- `lib/ingest/persist/source-identity.ts`
- `lib/ingest/persist/duplicate.ts`
- `lib/ingest/persist/support.ts`
- `lib/ingest/persist/composer.ts`
- `lib/ingest/persist/work.ts`
- `supabase/migrations/0005_organizations.sql`
- `supabase/migrations/0013_fix_org_member_rls.sql`
- `supabase/migrations/0014_backfill_org_member_rls_helpers.sql`
- `supabase/migrations/0015_fix_handle_new_user_search_path.sql`
- `docs/AUTH_AND_RLS_VERIFICATION.md`
- `docs/templates/auth-rls-verification-checklist.md`
- `docs/specs/auth-redirect-and-org-member-rls.md`
- `docs/specs/imslp-reference-ingestion.md`

## Key Routes

- `/auth/login`
- `/auth/signup`
- `/auth/callback`
- `/auth/confirm`
- `/admin/*`
- `/library/[orgSlug]/*`

## Key Tables And Functions

- `organization`
- `org_member`
- `user_profile`
- `handle_new_user()`
- `generate_slug(text)`
- `is_org_member(uuid)`
- `is_org_manager_or_owner(uuid)`
- `is_org_owner(uuid)`

## Resume Notes

- Preserve only safe internal redirect paths. Reject protocol-relative or external values.
- Generate only `redirect` in new auth flows; accept legacy `next` only when parsing older callback URLs.
- Keep `0013` historically representative. Use `0014` as the upgrade repair path.
- Keep `0015` as the forward repair for the auth bootstrap trigger; do not rewrite `0005` again without a deliberate migration-history decision.
- Non-admin users should never be bounced back into `/admin/*` after auth.
- The auth/RLS verification pass is signed off in production; use `docs/AUTH_AND_RLS_VERIFICATION.md` as historical evidence rather than as the active objective.
- The current stack-ranked order is: IMSLP ingestion foundation, then remaining library-management roadmap work, then billing/commercial packaging.
- The live verification fixture is:
  - org slug `auth-rls-verification-20260320`
  - org id `6228fd52-3a52-49b1-a3fa-50d8bf3a4d00`
  - owner `auth-rls-owner-20260320@example.com`
  - manager `auth-rls-manager-20260320@example.com`
  - member `auth-rls-member-20260320@example.com`
  - outsider `auth-rls-outsider-20260320@example.com`
- The latest hosted verification findings are:
  - owner redirect/login works
  - platform-admin `/admin/review` login-return works
  - outsider fallback works for both `/admin/*` and another org's library route
  - member `/catalog/new` access and create affordances are now fixed in production
  - manager and owner create paths remain intact
  - `org_member` live RLS checks now pass the core select/insert/update/delete matrix through `rest/v1` with real user JWTs
  - production signup confirmation now works through `/auth/confirm`
  - a fresh outsider signup correctly lands in the new user’s personal library rather than the requested verification org
- For concurrent agent work, prefer separate worktrees and branches, and claim file ownership in `Parallel Work Coordination` before editing.
- For source ingestion, keep the framework generic and isolate IMSLP-specific logic inside an adapter that uses official IMSLP list endpoints for discovery and `api.php` for detailed page extraction before considering HTML scraping.
- For implementation sequencing, use the task IDs in `docs/specs/imslp-reference-ingestion.md` rather than phase labels; the current path is adapter wiring and the first IMSLP execution slice after `T5-1` through `T5-3`.
- `T1-1` currently uses a queue-ready control-plane design rather than a minimal passive log table because large backfills are expected.
- Until the home-network IPv6 issue is fixed or managed backups are enabled, do manual logical backups from the phone/mobile network before linked-cloud migration work.
- Prefer updating the worklog and this file before ending a session.
