# Studio Platform Direction

## Purpose

Capture the current thinking about the possible future studio architecture so it can be revisited intentionally over time.

This is not a final decision document.

It records:
- the current preferred direction
- options that were considered
- why those options are not the default today
- the conditions that would justify revisiting the decision

## Current Recommendation

For now:

- keep products in separate repos
- keep products in separate Supabase projects
- define a future shared kernel conceptually before extracting large amounts of code
- extract only narrow, proven platform primitives when they are clearly shared

In practice, that means:
- OpusGraph remains its own repo and its own Supabase project
- GrantOS remains its own repo and should move to its own Supabase Cloud project
- future products like Atlas should also start as separate repos unless and until the shared package set becomes real enough to justify consolidation

## The Two Separate Ideas

There are two related but distinct ideas:

### 1. Studio OS

This is the operating system for the studio itself.

It is not app runtime code.

It includes:
- thesis
- venture criteria
- operating principles
- experiment framework
- portfolio planning
- decision logs
- studio-wide playbooks

### 2. Software Kernel

This is shared product infrastructure.

It may eventually include:
- auth and access
- orgs and memberships
- billing and entitlements
- admin and internal operations patterns
- event and audit primitives
- feature flags
- notifications
- analytics primitives
- shared UI primitives

The Studio OS can exist immediately as docs and decision-making structure.
The software kernel should be earned through extraction.

## Repo Strategy Options

### Option A: Separate Repos Now

Shape:
- `opusgraph`
- `grant-os`
- future product repos as needed
- optional `studio-os` repo for docs and operating-system thinking

Benefits:
- product boundaries stay clean
- deploys remain independent
- schema and workflow experimentation stays low-risk
- avoids premature platform coupling

Costs:
- some duplication across products
- slower shared-code reuse
- more discipline required to keep conventions aligned

Current recommendation:
- yes

### Option B: One Studio Monorepo Now

Shape:
- `apps/opusgraph`
- `apps/grantos`
- future apps
- `packages/kernel-*`
- `packages/ui`
- `docs/studio-os`

Benefits:
- easier shared-package reuse once abstractions are real
- one place for shared tooling and cross-product refactors

Costs:
- high risk of premature abstraction
- easier to blur product and kernel boundaries
- more tooling and CI complexity
- stronger pressure to centralize too much too early

Current recommendation:
- not yet

### Option C: Separate Repos First, Monorepo Later

Shape:
- separate product repos now
- revisit monorepo only after multiple products need stable shared packages

Benefits:
- lowest current risk
- preserves product speed
- keeps the monorepo as an earned move rather than a speculative one

Costs:
- later migration work if consolidation becomes worthwhile

Current recommendation:
- strongest current path

## Supabase Strategy Options

### Option 1: Same Supabase Project

Shape:
- OpusGraph and GrantOS share one Supabase project
- possibly separate schemas/tables
- shared auth, storage, secrets, quotas, and operational surface

Benefits:
- one auth system immediately
- simpler cross-product identity on paper
- fewer cloud projects to manage

Costs:
- shared blast radius
- harder migration safety
- RLS mistakes can affect both products
- storage and auth are still coupled even with separate schemas
- forces org/identity convergence too early

Current recommendation:
- no

### Option 2: Separate Supabase Projects

Shape:
- one Supabase project per product

Benefits:
- clean operational isolation
- easier debugging and rollback
- independent schema evolution
- better fit for distinct products at this stage

Costs:
- duplicate setup and ops work
- no shared identity by default

Current recommendation:
- yes

### Option 3: Shared Identity Later, Separate Data Always

Shape:
- separate Supabase projects now
- shared identity or SSO-like linkage only later if proven necessary

Benefits:
- preserves isolation now
- leaves room for convergence later
- avoids early database coupling

Costs:
- more architecture later if shared identity becomes important

Current recommendation:
- likely medium-term direction if cross-product user overlap becomes real

## Why We Are Not Pulling Everything Out Now

The main reason is abstraction risk.

Today, many parts of OpusGraph and GrantOS are only superficially similar. Pulling everything into a kernel now would likely:
- freeze the wrong boundaries
- make product-specific logic look generic
- slow product progress
- increase coupling before shared needs are proven

The current rule should be:

Extract only when:
- at least two products need the same behavior
- the abstraction can be named without product-specific language
- the rules are stable enough to maintain in multiple apps
- the shared layer simplifies more than it distorts

## What Already Looks Shared

Strong future kernel candidates across products:
- auth and redirect handling
- org and membership concepts
- access-control helpers
- admin/internal operations patterns
- Supabase environment/client boundaries
- audit/event conventions
- base UI primitives

## What Does Not Yet Look Shared

Keep these product-specific for now:
- OpusGraph reference and library domain
- GrantOS grants/opportunities/approvals/submissions domain
- search semantics
- taxonomy/tagging semantics
- comments/collaboration semantics
- ingestion mapping semantics
- product-specific admin workflows

## Triggers To Revisit This Direction

Revisit the repo and platform strategy when any of these become true:

### Monorepo trigger

- two or more products are active at the same time
- at least two or three shared packages are stable
- cross-repo duplication becomes more painful than consolidation

### Shared-kernel trigger

- the same auth/org/billing/admin/event logic is being copied across products
- package boundaries can be described without domain language
- the second product validates the same abstraction shape

### Shared-identity trigger

- users genuinely need one account across products
- orgs or permissions need to span multiple products
- cross-product workflow becomes a first-class requirement

## Near-Term Direction

Near-term priority order:

1. Continue shipping OpusGraph and GrantOS as separate products.
2. Move GrantOS from local Supabase to its own Supabase Cloud project.
3. Keep documenting likely shared seams.
4. Extract only narrow platform primitives when they are proven.
5. Revisit monorepo only after the first real shared package set exists.

## Related Docs

- `docs/specs/studio-kernel-v1.md`
- `docs/specs/studio-kernel-extraction-map.md`
- `docs/ARCHITECTURE.md`
