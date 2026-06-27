# Monetization Path

This document records the current OpusGraph monetization thesis and how it changes over time.

## How To Use This Document

- Treat the `Current Version` section as the active strategy.
- Append changes to `Version History` instead of silently overwriting prior strategy.
- When a monetization decision becomes durable, also record the decision in `docs/DECISIONS.md`.
- When pricing, packaging, or customer segment assumptions change materially, update this document and add a short `docs/WORKLOG.md` entry.

## Current Version

### 2026-06-27: Free Works Database plus paid workflow and library-management layers

#### Current Thesis

OpusGraph should make the public orchestral Works Database broadly free and monetize the higher-value workflow layers built around it.

The database is the acquisition engine, trust surface, SEO asset, and product moat. The business is not simply charging users to look up repertoire facts. The business is helping conductors, librarians, educators, ensembles, publishers, and researchers make decisions, manage collections, and move repertoire data into useful workflows.

#### Product Scope Assumption

The current cataloging focus is orchestral works. Wind ensemble, choral, chamber, and other repertoire categories may be added later, but they should not drive the first monetization model unless the product scope changes deliberately.

#### Why Database-Only Membership Is Weak

A low-cost membership for database lookup alone may produce some revenue, but it is unlikely to support the project by itself.

Reasons:

- Users are already trained to expect repertoire information to be free or low-cost.
- Existing repertoire sources are fragmented but usable enough for many casual searches.
- Public-domain and library-driven projects create downward pricing pressure.
- A user who only needs occasional facts has low willingness to pay.
- The highest-value users are not just browsing; they are programming seasons, managing libraries, preparing concerts, checking instrumentation, or maintaining organizational data.

Market anchors observed as of this version:

- Archive440 offers ensemble library-management pricing around free, low individual, and low organization tiers.
- Daniels' Orchestral Music Online charges annual subscription rates for curated orchestral reference data.
- IMSLP, Wind Repertory Project, CPDL-style models, and other public databases shape user expectations around free access.

These anchors support a cautious pricing posture: keep basic access free and charge for tools that save time, reduce operational pain, or support institutional workflows.

#### Recommended Monetization Structure

##### Free Public Layer

The free layer should maximize reach and data contribution.

- Public composer pages
- Public work pages
- Basic repertoire search
- Core metadata: title, composer, instrumentation, duration, dates, publisher/source links, provenance
- Public-domain score links where legal
- Community corrections and submissions
- Source/provenance visibility

Purpose:

- Build trust
- Grow the database
- Win search traffic
- Create inbound demand for paid workflows
- Establish OpusGraph as repertoire infrastructure rather than a closed lookup product

##### Paid Individual Layer

The individual paid layer should target conductors, librarians, educators, students, composers, and researchers who need deeper repertoire discovery.

Candidate name: `OpusGraph Pro`

Possible features:

- Advanced repertoire search by instrumentation, duration, era, forces, soloists, chorus, publisher, public-domain status, and source confidence
- Saved searches and saved repertoire lists
- Season-planning boards and shortlist comparison
- Program-builder exports
- AI-assisted repertoire recommendations with provenance
- "Find works like this" discovery
- CSV/PDF exports
- Private notes and tags

Initial pricing hypothesis:

- Monthly: `$5/month`
- Annual: `$49/year`
- Discounted student/educator option: around `$29/year`

This layer should remain inexpensive because the main competition is free research behavior plus scattered public databases.

##### Paid Organization Layer

The organization layer is the strongest near-term business path because it connects the public Works Database to an operational pain point.

Possible customers:

- Community orchestras
- Youth orchestras
- School orchestras
- Collegiate ensembles
- Small professional ensembles
- Conducting programs
- Libraries and archives

Possible features:

- Private ensemble library catalog
- Spreadsheet import
- Reference-work linking
- Local overrides for titles, instrumentation, publisher, notes, and holdings
- Performance history
- Part and copy tracking
- Rental/purchase status
- Multi-user roles
- Comments and review workflows
- Public or private repertoire lists
- Reports and exports

Initial pricing hypothesis:

- Small ensemble: `$12-19/month`
- Standard organization: `$29/month`
- Larger organization or institution: `$49-99/month`

This pricing should be tested against real ensemble willingness to pay and should stay close to the market's low-budget reality.

##### Services Layer

Concierge work can generate early revenue and accelerate product learning.

Possible services:

- Spreadsheet cleanup and import
- Library data normalization
- Initial catalog migration
- Custom repertoire research
- Publisher/composer data cleanup
- Institutional dataset preparation

Initial pricing hypothesis:

- Small import: `$250-500`
- Messy or larger import: `$750-1,500+`
- Custom institutional work: quote per scope

Services should feed the product roadmap rather than become unrelated consulting.

##### Data/API Layer

The normalized repertoire graph may become valuable as infrastructure if the data reaches sufficient quality and scale.

Possible customers:

- Publishers
- Rental libraries
- Music schools
- Researchers
- Music technology products
- Repertoire recommendation tools
- Grant, programming, and education platforms

Possible packaging:

- API access
- Bulk data exports
- Licensed normalized metadata
- Provenance-backed identifiers
- Enriched instrumentation and duration data

Initial pricing hypothesis:

- Developer/API lite: `$19/month`
- Institutional/API: `$99-299/month`
- Custom data license: negotiated

This layer should wait until the data is cleaner, better deduped, and legally reviewed.

##### Publisher, Composer, And Marketplace Layer

OpusGraph can eventually monetize high-intent repertoire discovery without charging basic users.

Possible approaches:

- Verified composer or publisher profiles
- Clearly labeled sponsored repertoire placements
- Availability links for rental, purchase, or perusal
- Affiliate/referral revenue where available
- Publisher dashboards showing discovery and click-through activity

Guardrails:

- Sponsored content must be labeled clearly.
- Search ranking should preserve trust.
- Paid placement should not override core metadata quality or relevance.

##### Grants And Sponsorship Layer

Grant funding and sponsorship may help subsidize the public-good aspect of the database, but they should not be the primary business model.

Possible framing:

- Open orchestral repertoire infrastructure
- Repertoire discovery equity
- Underrepresented composers and works
- Public-domain access and preservation
- Educational programming support

Use this layer opportunistically, especially when it funds data expansion or public-interest work.

#### Revenue Shape

Database-only membership requires a large audience to matter:

- `200` subscribers at `$5/month` = about `$12k ARR`
- `1,000` subscribers at `$5/month` = about `$60k ARR`
- `3,000` subscribers at `$5/month` = about `$180k ARR`

Organization subscriptions can reach meaningful revenue with fewer customers:

- `50` orgs at `$29/month` = about `$17.4k ARR`
- `200` orgs at `$29/month` = about `$69.6k ARR`
- `500` orgs at `$29/month` = about `$174k ARR`

The current conclusion is that organization workflow revenue is more plausible than database-only membership revenue, while the public database remains essential for acquisition and differentiation.

#### Current Positioning

Working positioning:

> The open orchestral works graph, with paid tools for conductors, librarians, educators, and ensembles who need to program, catalog, and manage repertoire.

Shorter product thesis:

> Free repertoire infrastructure. Paid serious-use workflow.

#### Near-Term Validation Questions

- Will conductors or librarians pay around `$49/year` for advanced repertoire discovery and saved planning workflows?
- Will community orchestras pay `$12-29/month` for catalog, performance-history, and part-tracking tools if spreadsheet import is easy?
- Which feature creates the first strong conversion moment: advanced search, season planning, private library import, or performance history?
- Can public database traffic produce enough qualified leads for the paid layers?
- Are publishers or composers willing to pay for verified profiles, availability links, or discovery analytics without damaging user trust?

#### Near-Term Product Implications

- Keep ingestion and provenance quality high; the free database is the long-term moat.
- Do not over-optimize early for database paywalls.
- Prioritize workflows that connect public works data to practical decisions.
- Build paid features so they degrade gracefully into a useful free database experience.
- Capture source confidence, instrumentation quality, and review status because these become paid-workflow differentiators.

## Version History

### 2026-06-27

Initial monetization path recorded.

Key direction:

- Public Works Database should remain broadly free.
- Paid value should come from workflow, library management, services, API/data licensing, and carefully labeled publisher/composer discovery surfaces.
- Database-only membership is possible but should be treated as a supplemental revenue stream, not the main economic engine.
