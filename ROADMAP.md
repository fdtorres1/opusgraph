# OpusGraph Roadmap

## ✅ Completed (MVP v1.0)

- [x] **Project Setup** - Next.js 16 with TypeScript and App Router
- [x] **Database Schema** - Complete Supabase migration with all tables, functions, and RLS policies
- [x] **Admin Work Editor** - Full-featured work editor with autosave, draft/publish, sources, and recordings
- [x] **API Routes** - RESTful API for CRUD operations on works
- [x] **Typeahead Search** - Composer and publisher search functionality
- [x] **Recording Embeds** - Automatic detection and embedding for YouTube, Spotify, Apple Music, SoundCloud
- [x] **Activity Tracking** - Revision history and activity feed (database schema)
- [x] **Review System** - Duplicate detection functions and review flag schema
- [x] **Deployment** - Vercel deployment with Next.js 16 compatibility
- [x] **GitHub Integration** - Repository, project board, and issue tracking

## 🚧 In Progress

*Currently no items in progress*

## 📋 Planned Features

### Phase 1: Core Admin Features

- [ ] **Composer Editor Page** - Admin interface for managing composer profiles
  - Autosave functionality
  - Draft/Published toggle
  - Birth/death year and place management
  - Nationality multi-select
  - Composer links management
  - Gender identity selection
  - Activity tracking
  - *Issue: [#1](https://github.com/fdtorres1/opusgraph/issues/1)*

- [ ] **Activity Panel UI** - Admin activity feed interface
  - Read from `activity_event` view
  - Group by date
  - Infinite scroll
  - Filter by event type (revision, comment, review_flag)
  - Clickable links to related entities
  - *Issue: [#4](https://github.com/fdtorres1/opusgraph/issues/4)*

- [ ] **Review Queue Management** - UI for managing review flags
  - Review queue page at `/admin/review`
  - List all open `review_flag` entries
  - Filter by reason (possible_duplicate, incomplete, etc.)
  - Side-by-side comparison modal for duplicates
  - Accept/merge/dismiss actions
  - *Issue: [#5](https://github.com/fdtorres1/opusgraph/issues/5)*

### Phase 2: Data Import & Management

- [ ] **CSV Import Functionality** - Bulk import with duplicate detection
  - CSV upload and staging
  - Field mapping UI
  - Validation (years, URLs, durations)
  - Duplicate detection using existing functions
  - Auto-flag duplicates for review
  - Transactional upsert
  - Row-level import report
  - *Issue: [#2](https://github.com/fdtorres1/opusgraph/issues/2)*

- [ ] **Location Search Integration** - Google Places/Nominatim integration
  - Server endpoint `/api/places` for location search
  - Google Places Autocomplete integration
  - Fallback to Nominatim when quota exceeded
  - Server-side caching
  - Store to `place` table on selection
  - *Issue: [#6](https://github.com/fdtorres1/opusgraph/issues/6)*

### Phase 3: Public Features

- [ ] **Public Search Interface** - Public-facing search page
  - Public search page at `/search`
  - Calls `public_min_works` and `public_min_composers` RPCs
  - Typeahead search functionality
  - Results display (name only for public)
  - Links to composer/work detail pages with sign-in prompt
  - *Issue: [#3](https://github.com/fdtorres1/opusgraph/issues/3)*

- [ ] **Public Detail Pages** - Composer and work detail pages
  - Show names only for public users
  - Full details with subscription
  - Sign-in/sign-up prompts
  - Recording embeds for public

### Phase 4: Subscription & Access

- [ ] **Stripe Integration** - Subscription management
  - Stripe Checkout integration
  - Customer Portal setup
  - Webhook handler for subscription events
  - Upsert `subscription` table on webhook events
  - Team and institutional subscription support
  - Seat count enforcement
  - *Issue: [#7](https://github.com/fdtorres1/opusgraph/issues/7)*

- [ ] **Team Management** - Team subscription features
  - Team creation and management
  - Team member invitations
  - Seat management

- [ ] **Institutional Access** - Library/SAML-like access
  - Institution creation
  - IP range configuration
  - SAML/SSO integration (future)

### Phase 5: Enhanced Features

- [ ] **Full-Text Search** - Enhanced search with PostgreSQL
  - Full-text search implementation
  - Search across works, composers, instrumentation
  - Advanced search filters

- [ ] **Tags & Taxonomy** - Work tagging system
  - Tag management
  - Tag-based filtering
  - Tag categories

- [ ] **Export & Reporting** - Data export features
  - CSV export
  - PDF reports
  - API documentation

## 🎯 Future Considerations

- Mobile app (React Native)
- Advanced analytics dashboard
- API for third-party integrations
- Collaborative editing features
- Version control for works
- Multi-language support
- Integration with music libraries (Spotify, Apple Music APIs)
- Image upload for composer portraits
- Score preview/integration

## Version History

- **v1.0.0** (Current) - MVP with admin work editor and basic infrastructure
- **v1.1.0** (Planned) - Composer editor and activity panel
- **v1.2.0** (Planned) - CSV import and review queue
- **v2.0.0** (Planned) - Public features and subscriptions

