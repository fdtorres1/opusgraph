# August 1 First-Dollars Plan

## Snapshot

Date: 2026-06-27

Goal: reach a basic working state that can produce first dollars by 2026-08-01.

This is not a full product launch plan. It is a cut-down chargeable-beta plan based on the live repository and database state on 2026-06-27.

## Current State

- Production build: passes with elevated local permissions.
- Lint: passes with warnings; latest observed count was 117 warnings and 0 errors.
- Tests: no meaningful automated test suite is currently present.
- Billing: not implemented beyond schema placeholders such as `organization.plan_tier` and `stripe_customer_id`.
- Library data: live database had 0 `library_entry` rows and 0 `performance` rows.
- Reference data: live database had 3385 works and 3151 composers.
- Public reference visibility: live database had 0 published works and 11 published composers, so public work search currently returns no works.
- Review burden: live database had 3592 open review flags, including 3305 `orchestral_scope_review` flags and 287 `possible_duplicate` flags.
- IMSLP work ingestion: operational but still hands-on; recent work is around offsets 3700-3800, and the latest observed dry run at offset 3800 had 54 missing-composer failures.

## Cutthroat Assessment

The fastest credible path to first dollars is not a polished public Works Database, not a marketplace, and not a completed AI search layer.

The fastest credible path is a paid concierge/library-management beta:

- sell a setup/import service first
- use the existing org-scoped library-management product as the customer-facing workspace
- charge for getting a real ensemble out of a spreadsheet and into a usable catalog
- defer fully automated billing, marketplace, AI search, and broad public reference launch

The public Works Database is strategically important, but it is not ready to sell or rely on for acquisition while all works are still draft.

## August 1 Chargeable Beta Scope

Must have:

- one clean production deployment
- one demo org with realistic seed library data
- owner/manager/member role verification for the library flows
- catalog create/edit/search
- CSV import parse, validate, execute
- parts, condition, location, notes, tags
- performance logging if stable enough; otherwise present it as beta
- settings/member invite flow if stable enough; otherwise manually provision accounts
- manual payment path using Stripe payment links or invoices
- founder-led onboarding and import
- visible support/contact path
- backups/runbook before onboarding real customer data

Can defer:

- automated Stripe checkout and customer portal
- self-serve subscription lifecycle
- natural-language search
- saved searches and season boards
- public work publishing at scale
- marketplace, quote requests, referrals, storefronts, commerce
- automated IMSLP ingestion beyond the next safe slices
- API/data licensing

## Security And Stability Minimum

- Re-run auth and org-member RLS verification against production before handling customer data.
- Verify library CRUD access by role, including direct URL/API attempts by a plain member.
- Verify cross-org isolation with at least two orgs.
- Confirm import cannot write into an org where the user is not owner or manager.
- Confirm library entry, tag, comment, member, settings, and performance endpoints all enforce org membership and role checks consistently.
- Enable or verify usable Supabase managed backups; keep a manual logical backup path for pre-migration work.
- Add a minimal smoke-test checklist if automated tests are not added before August 1.
- Fix only launch-risk lint warnings; do not burn July trying to make the lint output perfect.

## Data Minimum

For first dollars, the customer library can be useful with private customer data even if the public reference database remains mostly draft.

Minimum public/reference goal by August 1:

- publish a small, manually reviewed seed set rather than the whole IMSLP corpus
- target enough canonical orchestral works to make demos and reference linking credible
- keep provenance visible
- do not bulk-publish quarantined IMSLP rows

Suggested target:

- 100-300 clean published works for demos and linking
- 100-200 clean published composers if needed for public browsing
- one strong demo data set showing common orchestra-library use

## Work Plan

Week 1, 2026-06-27 to 2026-07-05:

- freeze August 1 scope around concierge import plus org catalog
- create demo org and seed realistic demo library entries
- run role/security smoke tests
- verify import end to end with a messy CSV
- decide whether performance logging is stable enough for the paid beta
- create payment links or manual invoice process

Week 2, 2026-07-06 to 2026-07-12:

- fix blockers from smoke tests
- tighten import validation and failure reporting
- add minimal customer-facing onboarding copy and support path
- publish a small reviewed reference seed set
- prepare two sales artifacts: demo script and one-page offer

Week 3, 2026-07-13 to 2026-07-19:

- onboard one friendly test ensemble or manually import a realistic sample library
- run a private beta workflow from login through catalog use
- fix only blockers that would embarrass a paid beta
- document backup, restore, and support procedures

Week 4, 2026-07-20 to 2026-07-26:

- start charging for concierge setup/import
- sell the beta as founder-supported, not self-serve SaaS
- keep scope to catalog/import/search/parts/tags/notes and optionally performance history
- gather feedback and log product blockers

Final week, 2026-07-27 to 2026-08-01:

- stabilize onboarding
- clean the demo
- collect first payment
- avoid major architecture changes

## First Offer

Recommended first paid offer:

`OpusGraph Library Setup Beta`

- one-time setup/import: $250-500 for a small ensemble spreadsheet
- includes 30-60 days of beta access
- optional ongoing beta subscription: $12-29/month after setup

This is more credible than asking strangers to pay for a public database whose live work rows are still unpublished.

## Biggest Risks

- Public database optics: there are currently no published works.
- Data trust: the IMSLP corpus is heavily quarantined and should not be bulk-published.
- Security confidence: auth/RLS has prior signoff, but library routes need a fresh role-isolation pass.
- No tests: production build passing is not the same as workflow confidence.
- No billing: manual payment is acceptable for first dollars, but self-serve SaaS billing will not be ready without focused work.
- No real customer data: 0 live library entries means the product has not yet been exercised with real operating data.

## Decision

Proceed toward August 1 only if the target is first dollars from a paid, founder-led beta.

Do not frame August 1 as a public SaaS launch. Frame it as the first paid customer/import cohort.

## AI-Accelerated Scenario

This section revises the plan for a maximum-AI push across the five-week window.

The conclusion changes from "paid concierge beta only" to "paid concierge beta plus a meaningfully prepared public database seed" if AI agents are used aggressively and in parallel.

The target is still not a fully mature public SaaS. The more ambitious target is:

- a usable paid library-management beta
- a credible public Works Database seed
- a clear quality/provenance posture
- enough data depth to support demos, early search traffic, and reference linking

## What AI Can Accelerate

AI can materially compress:

- IMSLP candidate review and classification
- normalization of titles, composers, instrumentation, durations, dates, and source notes
- duplicate-cluster analysis
- creation of review queues and QA reports
- seed-set selection for publishable orchestral repertoire
- fixture/demo-library creation
- UI implementation and polish
- security smoke-test generation
- documentation, onboarding, sales collateral, and runbooks

AI should not directly:

- promote uncertain works to `published`
- invent missing metadata
- override source provenance
- merge duplicate works without a deterministic or human-auditable reason
- make rights, edition, publisher, rental, or availability claims without source evidence

## AI Operating Model

Use multiple parallel AI workstreams with separate branches/worktrees and explicit file ownership.

Recommended workstreams:

- Data pipeline and QA: improve ingestion scripts, staging reports, candidate exports, promotion gates, and exact coverage checks.
- Repertoire review: classify orchestral scope, normalize metadata, flag suspicious rows, and prepare publishable candidate batches.
- Duplicate review: cluster possible duplicates, identify obvious same-source/same-work cases, and produce merge recommendations.
- Library product: harden catalog/import/parts/tags/performance/settings flows for beta use.
- Security and stability: role-isolation tests, cross-org access checks, API permission probes, and production smoke checklist.
- Public database UX: make search/browse/detail pages usable for the published seed set.
- Commercial launch: demo org, onboarding copy, offer page, payment-link flow, beta terms, and outreach artifacts.

## AI-Accelerated Data Target

The original conservative target was 100-300 clean published works.

With heavy AI assistance, a more ambitious but still defensible target is:

- publish 500-1500 reviewed orchestral works
- publish corresponding composer records needed by those works
- keep all other IMSLP/imported rows draft or quarantined
- publish only rows with source-backed minimum fields
- keep `orchestral_scope_review` and `possible_duplicate` flags open unless they are actually resolved

Minimum publishable-work standard:

- title present
- composer linked
- orchestral scope is positive or human-reviewed
- source URL/provenance present
- no unresolved same-source duplicate collision
- no known parser failure that affects core display fields
- status change is recorded in a review/promotion artifact

Do not chase full corpus publication by August 1. A smaller trustworthy public database is more valuable than a large polluted one.

## AI-Accelerated Week Plan

Week 1, 2026-06-27 to 2026-07-05:

- stand up parallel worktrees and ownership map
- build deterministic candidate export and AI review packet format
- create publishability rubric and machine-checkable promotion gate
- seed demo org and test library import with realistic CSVs
- run security smoke tests on org isolation and role permissions
- select first 250-500 obvious publish candidates

Week 2, 2026-07-06 to 2026-07-12:

- run AI-assisted review batches for orchestral scope, duplicates, and metadata quality
- promote first reviewed public seed batch
- harden public search and work/composer detail display for the seed
- fix top beta blockers in catalog/import/tags/parts/settings
- create payment links or invoice workflow

Week 3, 2026-07-13 to 2026-07-19:

- expand reviewed seed toward 750-1000 works if quality stays high
- run deeper duplicate-cluster review on canonical/high-value repertoire
- onboard at least one friendly library beta dataset
- write restore/support runbook and customer-data handling checklist
- prepare demo script and beta sales page/collateral

Week 4, 2026-07-20 to 2026-07-26:

- freeze product scope
- polish demo and public database landing/search paths
- finish beta security/stability checklist
- collect first paid setup/import commitment if possible
- keep AI work focused on data QA and blocker fixes, not new feature ideas

Final week, 2026-07-27 to 2026-08-01:

- publish final pre-launch seed batch only if it clears gates
- stop major ingest or schema changes
- run production smoke tests
- collect first payment
- record known limitations publicly enough to preserve trust

## Updated Cutthroat Assessment

With aggressive AI use, the August 1 target can be more ambitious than concierge library beta alone.

The credible target is:

- paid founder-led library setup/import beta
- public Works Database seed with hundreds to low-thousands of reviewed works
- enough reference data to make OpusGraph feel real in demos

The still-not-credible target is:

- fully self-serve SaaS
- clean full IMSLP corpus
- autonomous AI-curated database without review gates
- marketplace/commerce
- production-grade natural-language search
- broad public claim that the database is comprehensive

The key management problem is coordination. AI makes throughput cheap, but quality failures compound fast in a database product. The winning pattern is many agents producing candidate work, with narrow deterministic gates deciding what lands in production.

## Aggressive Public-Index Scenario

The user pushed for a more ambitious public launch target: 10000-20000 public works by 2026-08-01, using AI and multi-source confirmation so every work does not require manual human review.

This is viable only if the product distinguishes between:

- fully reviewed canonical records
- source-confirmed public index records
- lower-confidence draft/quarantine records

The plan is not viable if every public row is presented as equally curated, equally complete, and personally verified.

## Triple-Confirmation Model

AI may be allowed to promote records into a public index without human review when promotion is source-backed, field-specific, and auditable.

Use triple confirmation for core identity:

- work title or normalized title
- composer identity
- source existence

A row can be public-index eligible if it has:

- one source identity from the ingest source
- at least two independent corroborating source references for the same composer-work pair, or one very strong authority source plus one independent corroborator
- no unresolved same-source duplicate collision
- no hard parser failure on title or composer
- stored evidence links and extracted snippets/fields for each source

This is not "AI as truth." It is "AI as adjudicator over cited source evidence." The database truth is the stored evidence and the deterministic promotion decision.

## Field-Level Confidence

Do not treat the record as one binary truth object. Track confidence by field.

Recommended fields:

- identity confidence: title plus composer
- orchestral-scope confidence
- instrumentation confidence
- duration confidence
- composition-date confidence
- publisher/source confidence
- availability confidence

Example launch posture:

- title/composer/source: high confidence
- instrumentation: medium confidence
- duration: unknown
- publisher: source-reported, not normalized
- availability: not asserted

This allows public scale without pretending every detail is complete.

## Public Status Tiers

The current `draft` / `published` model is too coarse for a 10000-20000 work public launch.

Recommended launch tiers:

- `draft`: internal only
- `quarantined`: internal review only
- `indexed`: public, source-backed, not fully curated
- `verified`: public, stronger source confirmation or human/advanced review
- `canonical`: public, high-confidence normalized record suitable for prominent recommendations

If the enum cannot be changed quickly, approximate this with metadata and UI labels, but the product should not expose all public rows as if they are equally reviewed.

## Viability Of 10000-20000 Works By August 1

Viable:

- 10000-20000 public indexed work pages with source links, confidence labels, and incomplete-field tolerance
- 1000-3000 better-reviewed orchestral/canonical records if source supply and QA pipeline perform well
- public search over indexed records
- public messaging that this is an open repertoire index with visible provenance

Not viable:

- 10000-20000 fully normalized, deduped, instrumentation-complete, high-trust orchestral records
- universal triple-source confirmation for every useful field
- human review of every row
- unqualified marketing claim that the database is comprehensive or fully verified

## Required Pipeline For Public Scale

To attempt the aggressive scenario, build a staged ingestion and promotion pipeline:

1. Source harvest:
   - ingest raw records from IMSLP and other source adapters
   - store raw source identity and payloads
2. Candidate normalization:
   - AI and deterministic parsers normalize title, composer, instrumentation, dates, and source metadata
3. Source corroboration:
   - search or query independent sources for the composer-work pair
   - store evidence references
4. AI adjudication:
   - compare source evidence and assign field-level confidence
   - output structured JSON, not prose
5. Deterministic gate:
   - reject rows with schema errors, duplicate collisions, missing core identity, or insufficient evidence
6. Public tier assignment:
   - promote to `indexed`, `verified`, or keep in `draft` / quarantine
7. Post-promotion audit:
   - sample batches statistically
   - measure false-positive and duplicate rates
   - roll back or demote bad batches

## Model Use

Cheap batch models can do high-volume first-pass work:

- source extraction
- title normalization
- obvious non-orchestral filtering
- duplicate hints
- confidence summaries

Stronger models should handle:

- disputed duplicate clusters
- ambiguous instrumentation
- source-conflict adjudication
- promotion-rule design
- sampled audit review

Human review should focus on:

- calibration sets
- high-traffic/canonical works
- suspicious batches
- source-policy decisions
- public claims and launch messaging

## Updated Assessment

With triple-confirmation and public confidence tiers, an August 1 launch with 10000-20000 public work pages is possible but risky.

The product must launch as a provenance-backed repertoire index, not as a finished expert-curated database.

The business upside is higher because the public database can become an acquisition surface immediately. The downside is that quality errors become public, searchable, and brand-forming. The only acceptable version is one where uncertainty is visible and the system can demote, correct, and audit records quickly.
