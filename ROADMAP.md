# OpusGraph Roadmap

## ✅ Completed (MVP v1.0 - v1.7.0)

- [x] **Project Setup** - Next.js 16 with TypeScript and App Router
- [x] **Database Schema** - Complete Supabase migration with all tables, functions, and RLS policies
- [x] **Admin Work Editor** - Full-featured work editor with autosave, draft/publish, sources, and recordings
- [x] **Admin Composer Editor** - Full-featured composer editor with autosave, draft/publish, nationalities, links, and gender identity
- [x] **API Routes** - RESTful API for CRUD operations on works and composers
- [x] **Typeahead Search** - Composer, publisher, and country search functionality
- [x] **Recording Embeds** - Automatic detection and embedding for YouTube, Spotify, Apple Music, SoundCloud
- [x] **Activity Tracking** - Revision history and activity feed (database schema)
- [x] **Activity Panel UI** - Admin activity feed with filtering, grouping, and infinite scroll with local timestamps
- [x] **Admin Dashboard** - Enhanced dashboard with statistics (composer/work counts, review flags) and recent activity preview
- [x] **Sidebar Navigation** - Collapsible left sidebar with icon-only mode, tooltips, and keyboard shortcuts
- [x] **List Pages** - Composers and Works list pages with grid view and status badges
- [x] **Review Queue Page** - Basic review queue page for managing review flags
- [x] **Review Queue Management** - Enhanced review queue with filtering, comparison, and merge functionality
- [x] **Review System** - Duplicate detection functions and review flag schema
- [x] **Authentication** - Login/signup pages with Supabase Auth
- [x] **Deployment** - Vercel deployment with Next.js 16 compatibility
- [x] **GitHub Integration** - Repository, project board, and issue tracking

## 🚧 In Progress

*Currently no items in progress*

## 📋 Planned Features

### Phase 1: Core Admin Features

- [x] **Composer Editor Page** - Admin interface for managing composer profiles ✅
  - Autosave functionality
  - Draft/Published toggle
  - Birth/death year and place management
  - Nationality multi-select
  - Composer links management
  - Gender identity selection
  - Activity tracking
  - *Issue: [#1](https://github.com/fdtorres1/opusgraph/issues/1) - Completed*

- [x] **Activity Panel UI** - Admin activity feed interface ✅
  - Read from `activity_event` view
  - Group by date
  - Infinite scroll
  - Filter by event type (revision, comment, review_flag)
  - Filter by entity type (composer, work)
  - Clickable links to related entities
  - Actual timestamps in local timezone
  - *Issue: [#4](https://github.com/fdtorres1/opusgraph/issues/4) - Completed*

- [x] **Review Queue Management** - UI for managing review flags ✅
  - Review queue page at `/admin/review`
  - List all open `review_flag` entries
  - Filter by reason (possible_duplicate, incomplete, etc.)
  - Filter by status (open, resolved, dismissed)
  - Side-by-side comparison modal for duplicates
  - Resolve/dismiss/merge actions
  - Entity name display and detailed comparison view
  - Activity tracking for review actions
  - *Issue: [#5](https://github.com/fdtorres1/opusgraph/issues/5) - Completed*

### Phase 2: Data Import & Management

- [x] **CSV Import Functionality** - Bulk import with duplicate detection ✅
  - CSV upload and parsing
  - Field mapping UI
  - Validation (years, URLs, durations, country codes)
  - Duplicate detection using existing functions
  - Auto-flag duplicates for review
  - Transactional upsert
  - Row-level import report with success/failure details
  - Multi-step wizard (Upload → Map → Validate → Execute → Results)
  - Support for both composers and works
  - *Issue: [#2](https://github.com/fdtorres1/opusgraph/issues/2) - Completed*

- [x] **Location Search Integration** - Google Places/Nominatim integration ✅
  - Server endpoint `/api/places` for location search
  - Google Places Autocomplete integration
  - Fallback to Nominatim when quota exceeded
  - Server-side caching
  - Store to `place` table on selection
  - LocationSearch component with autocomplete
  - Integration with composer editor for birth/death places
  - *Issue: [#6](https://github.com/fdtorres1/opusgraph/issues/6) - Completed*

### Phase 3: Public Features

- [x] **Public Search Interface** - Public-facing search page ✅
  - Public search page at `/search` with typeahead functionality
  - Calls `public_min_works` and `public_min_composers` RPCs via `/api/public/search`
  - Typeahead search with 300ms debounce
  - Tab-based filtering (All/Composers/Works) with result counts
  - Results display (name only for public users)
  - Links to composer/work detail pages with sign-in prompts
  - Public detail pages showing names only with subscription prompts
  - Search button added to homepage
  - *Issue: [#3](https://github.com/fdtorres1/opusgraph/issues/3) - Completed*

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

- **v1.0.0** - MVP with admin work editor and basic infrastructure ✅
- **v1.1.0** - Composer editor, activity panel, and enhanced dashboard ✅
- **v1.2.0** - Sidebar navigation, list pages, and review queue page ✅
- **v1.3.0** - Review queue management with filtering, comparison, and merge ✅
- **v1.4.0** - Location search integration with Google Places and Nominatim ✅
- **v1.5.0** - CSV import functionality with validation and duplicate detection ✅
- **v1.6.0** - Public search interface with typeahead and detail pages ✅
- **v1.7.0** - Delete functionality for composers and works with confirmation dialogs ✅
- **v1.7.1** - Bug fixes: login redirect and clickable header ✅
- **v1.7.2** - User profile page and logout button in sidebar footer ✅
- **v2.0.0** (Planned) - Subscription features and Stripe integration

