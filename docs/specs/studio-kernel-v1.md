# Studio Kernel v1

## Purpose

Define a practical shared platform layer for a small venture studio or mini-holdco without overbuilding a speculative monolith.

This document treats OpusGraph as the first proving ground for the kernel, not as the kernel itself.

The goal is to identify:
- what should be shared across products
- what should remain product-specific
- what should be extracted only after a second product proves the need
- what OpusGraph can harden first

## Core Thesis

A shared kernel is valuable if it reduces repeated operational work across products:
- user and org management
- permissions
- billing
- internal operations
- experiments and lead capture
- instrumentation

It is not valuable if it forces unrelated products into fake abstractions too early.

The kernel should therefore be built by extraction, not by speculation.

## Design Principle

The kernel should provide platform primitives, not domain logic.

That means:
- shared identity model, yes
- shared billing primitives, yes
- shared event tracking, yes
- shared review/admin tooling patterns, yes
- shared classical-music data model, no
- shared grant application workflow, no
- shared artist-opportunity ontology, no

## Architecture Shape

Recommended structure:

### Layer 1: Shared Platform

This is the real kernel.

- accounts, users, orgs, memberships
- role and permission primitives
- billing entities, subscriptions, entitlements
- internal admin and support operations
- notifications infrastructure
- feature flags and rollout controls
- event logging and analytics
- experiment pages and lead capture

### Layer 2: Shared Modules

These are reusable only after at least two products need them in materially similar ways.

- search infrastructure
- tagging and taxonomy framework
- saved views
- alerts and subscriptions
- ingestion pipelines and job queues
- review workflows

### Layer 3: Product Domains

These stay product-specific.

- OpusGraph reference database and library management
- Artist Opportunity Atlas opportunity and artist domain
- GrantOS grant workflow and compliance domain

## Kernel v1 Scope

Kernel v1 should be intentionally narrow.

### Include in v1

- `organizations`
  - org creation
  - membership
  - seat concepts if needed
  - personal-org pattern for solo users

- `identity and access`
  - authentication
  - role assignments
  - route protection
  - permission checks
  - audit-friendly actor model

- `billing primitives`
  - billing account
  - subscription state
  - plan entitlement checks
  - Stripe integration surface

- `admin operations`
  - internal admin console
  - account/org lookup
  - membership troubleshooting
  - support notes or support state hooks

- `event and notification infrastructure`
  - event log / audit trail
  - email notification triggers
  - system notifications abstraction

- `experiments and lead capture`
  - waitlist capture
  - landing page template
  - conversion event tracking

- `feature flags`
  - environment-aware rollouts
  - org or user scoped flags
  - internal-only beta access

- `analytics hooks`
  - shared event naming conventions
  - funnel instrumentation
  - product-agnostic telemetry primitives

### Exclude from v1

- product-facing search semantics
- global taxonomy system across all products
- saved views as a universal abstraction
- support inbox as a full product area
- ingestion workflows beyond generic job/queue primitives
- product-specific admin workflows disguised as shared ops

## Why This Scope Is Defensible

The v1 scope is defensible because it sits close to operational repetition.

Across a venture studio, nearly every product needs:
- users
- orgs
- access control
- plan checks
- admin operations
- notifications
- analytics

But not every product needs:
- the same search model
- the same saved object model
- the same domain taxonomy
- the same ingestion workflow

Those should be extracted only when similarity is proven.

## What OpusGraph Already Proves

OpusGraph already contains strong candidates for kernel extraction:

- org-scoped multi-tenancy
- per-org membership and roles
- dual-layer auth model patterns
- route and API authorization patterns
- audit trail patterns
- admin moderation and review patterns
- import / background processing patterns
- public plus private product surfaces

In particular, these concepts feel kernel-like:
- `organization`
- `org_member`
- role-based permissions
- internal admin access
- revision / audit events
- protected-route middleware patterns

## What Should Stay in OpusGraph

These are clearly product-domain concerns and should not be extracted into the kernel:

- composers, works, recordings, sources
- library entries and parts
- reference-data merge logic
- performance history
- classical-music metadata structures
- catalog-specific search and filtering semantics
- music-library comments as currently modeled

Even if another product later has comments, tags, or imports, the current OpusGraph implementations are still too domain-shaped to assume they are kernel-ready.

## First Extractions from OpusGraph

OpusGraph should harden the kernel by extraction in this order:

### 1. Organization and Membership Model

Extract:
- organization entity
- membership table shape
- role model
- personal-org support
- membership helper functions and access patterns

Reason:
- this is the strongest shared primitive
- it already underpins billing and access
- future studio products will likely need org and solo-user support

### 2. Authorization and Access Layer

Extract:
- auth helpers
- route protection patterns
- server-side permission checks
- policy helper patterns
- audit-safe actor resolution

Reason:
- every product needs auth
- every product benefits from one permission vocabulary
- auth mistakes are expensive to relearn

### 3. Billing and Entitlement Surface

Extract:
- billing account concept
- plan tier model
- entitlement checks
- Stripe wiring boundary

Reason:
- this becomes a studio-wide commercial backbone
- it is operationally painful to rebuild in each product

### 4. Audit and Operations Layer

Extract:
- revision/event pattern
- actor + entity + action conventions
- internal admin review patterns

Reason:
- this creates shared observability and support leverage
- it helps the studio operate multiple products with one internal discipline

### 5. Notification and Experiment Infrastructure

Extract:
- email trigger abstractions
- waitlist capture primitives
- event-driven notifications
- feature flags

Reason:
- these accelerate product experiments across ventures
- they matter earlier than generalized search or taxonomy

## What To Defer Until Product 2 or 3

These should wait for proof:

### Search

Do not build a universal search abstraction yet.

Instead:
- share indexing infrastructure patterns if needed
- keep search semantics product-specific

Reason:
- search fields, ranking, and objects diverge quickly

### Taxonomy / Tagging

Do not create a global taxonomy model until two products need overlapping behavior.

Reason:
- taxonomies are usually domain language disguised as infrastructure

### Saved Views / Alerts

Defer these until two products need:
- persistent filters
- subscriptions to changes
- repeatable monitoring workflows

Reason:
- they often depend on product-specific query semantics

### Ingestion Framework

Share queue and job primitives early if useful.
Do not share ingestion semantics early.

Reason:
- imports and syncs are operationally similar
- parsing and mapping logic are not

## Recommended Technical Shape

Do not start with one giant studio monolith.

Prefer:
- shared packages or modules for core platform behavior
- shared database primitives where the abstraction is genuinely stable
- product-specific domain schemas on top
- one design system with room for product differentiation

Possible shape:
- `kernel-auth`
- `kernel-orgs`
- `kernel-billing`
- `kernel-events`
- `kernel-flags`
- `kernel-admin`

Then product modules:
- `opusgraph-domain`
- `atlas-domain`
- `grantos-domain`

## Decision Heuristic

A capability belongs in the kernel only if most of the following are true:

- at least two products need it
- the abstraction can be named without domain language from one product
- it reduces operational or engineering repetition
- its rules are unlikely to diverge significantly by product
- forcing it shared will simplify, not distort, product design

If those are not true, keep it product-specific.

## Near-Term Implications for OpusGraph

For now, OpusGraph should continue shipping as OpusGraph.

But from this point forward:
- name abstractions carefully
- isolate generic auth/org/billing concepts from music-domain logic
- avoid baking classical-music assumptions into primitives that might become shared
- let real second-product pressure determine what gets extracted

In practice:
- use OpusGraph to harden the org, auth, audit, and billing surfaces
- do not stop product progress to build a speculative studio platform
- treat every extraction as something that must earn its way out of the product

## Recommended Next Step

Do not start coding a separate studio kernel yet.

First produce a small extraction map:
- `shared now`
- `shared later`
- `never shared`

for the current OpusGraph codebase.

That will let future work on OpusGraph improve the eventual kernel without forcing a premature rewrite.
