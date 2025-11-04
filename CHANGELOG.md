# Changelog

All notable changes to OpusGraph will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Stripe Integration

## [1.7.5] - 2025-01-27

### Added
- **Authenticated Detail Views**: Individual users can now view full composer and work details on public pages
- **Public Header**: Added logout button and user email to customer-facing pages with navigation menu
- **Browse All Composers Page** (`/composers`): List all published composers with links to detail pages
- **Browse All Works Page** (`/works`): List all published works with links to detail pages
- **Navigation Links**: Added Search, Composers, and Works links in PublicHeader (desktop)
- **Quick Links**: Added "Browse All Composers" and "Browse All Works" links on search page
- **RLS Policies**: Added database policies to allow Individual users to read published content

### Changed
- Public detail pages now fetch and display full data when user is authenticated (instead of redirecting to admin)
- Search page hides sign-in prompts when user is logged in
- Authenticated users see full details in public-facing UI (not admin UI)
- PublicHeader now includes navigation menu for authenticated users
- Improved navigation flow between search, browse, and detail pages

### Fixed
- Type errors with Supabase array responses for foreign key relationships
- Normalized birth_place/death_place arrays to single objects in composer detail
- Normalized composer/publisher/ensemble arrays to single objects in work detail
- Missing `Link` import in search page causing build error

### Technical
- Database migration `0004_individual_user_read_policy.sql` adds RLS policies for Individual users
- New components: `AuthenticatedComposerDetail`, `AuthenticatedWorkDetail`, `PublicHeader`
- Public pages check authentication and fetch appropriate data based on user status
- Browse pages use existing public RPCs (`public_min_composers`, `public_min_works`)

## [1.7.4] - 2025-01-27

### Performance
- **Search Performance Optimization**: Significant improvements to search speed and responsiveness
- Added GIN trigram indexes for composer and work name searches with accent-insensitive support
- Created `unaccent_immutable()` function for use in index expressions
- Added partial indexes on `status='published'` for faster filtering
- Search queries now run in parallel using `Promise.all` (composers and works searched simultaneously)
- Reduced debounce delay from 300ms to 150ms for more responsive search experience
- Added `LIMIT 50` and `ORDER BY` to search functions for consistent, sorted results

### Changed
- Search API endpoint now executes composer and works queries in parallel instead of sequentially
- Search debounce reduced from 300ms to 150ms for faster response to user input

### Technical
- Database migration `0003_search_indexes.sql` adds performance indexes
- Trigram indexes enable efficient LIKE queries even with leading wildcards
- Partial indexes only index published records for better performance

### Expected Performance Improvements
- 70-90% faster: Trigram GIN indexes accelerate LIKE queries
- 50% faster: Parallel queries reduce total time when searching both types
- More responsive: Reduced debounce provides immediate feedback

## [1.7.3] - 2025-01-27

### 🔒 Security
- **CRITICAL FIX**: New signups no longer receive admin access by default
- Added database trigger to automatically create `user_profile` with `admin_role='none'` for all new signups
- Individual users (role='none') are now blocked from accessing `/admin` routes via middleware
- Auth callback and login now redirect based on user role:
  - Individual users → `/search`
  - Admin/Contributor users → `/admin`

### Added
- Database migration `0002_auto_create_user_profile.sql` with trigger and backfill
- Auth helper functions in `lib/auth.ts` for role checking
- Backfill for existing users without profiles (sets them to `admin_role='none'`)

### Changed
- Middleware now checks user role before allowing `/admin` route access
- Login redirect logic now checks user role instead of defaulting to `/admin`
- Auth callback redirect logic now respects user role

### Migration Required
⚠️ **IMPORTANT**: Run `supabase/migrations/0002_auto_create_user_profile.sql` in Supabase Dashboard → SQL Editor to apply the security fix.

## [1.7.2] - 2025-01-27

### Added
- User profile link in sidebar footer showing email address
- User profile page at `/admin/profile` displaying account information
- Logout button in sidebar footer for easy sign-out
- Profile page shows email, user ID, email verification status, and account creation date

### Changed
- Sidebar footer now includes user account controls with visual separator
- Profile link highlights when active page is profile
- Logout redirects to login page after signing out

## [1.7.1] - 2025-01-27

### Fixed
- Login redirect now sends all admin/contributor users to dashboard (`/admin`) instead of create work page
- Auth callback redirect now defaults to dashboard instead of create work page
- "OpusGraph Admin" header text is now clickable and returns to dashboard
- Added hover underline on header link for better UX

## [1.7.0] - 2025-01-27

### Added
- Delete buttons (trash icon) to composer and work editor pages
- DELETE API endpoints for composers and works with admin-only access
- Confirmation dialogs before deletion with clear warnings
- Deletion logging in activity feed via revision table

### Changed
- Delete buttons only visible when editing existing entries (not new)
- Admin-only deletion (super_admin and admin roles only, contributors cannot delete)

### Technical
- Cascade deletes handled by database foreign keys
- Proper authorization checks on DELETE endpoints
- Error handling with user-friendly messages
- Redirect to list pages after successful deletion

## [1.6.0] - 2025-01-27

### Added
- Public Search Interface at `/search` with typeahead functionality
- Public API endpoint (`/api/public/search`) using public RPCs
- Search results UI with tabs for All/Composers/Works
- Public composer detail pages (`/composers/[id]`) showing names only with sign-in prompts
- Public work detail pages (`/works/[id]`) showing work names and composer links with sign-in prompts
- Public Supabase client for unauthenticated access
- Search button added to homepage as primary action
- Debounced search with 300ms delay
- Loading states and empty state messages
- Navigation between search results and detail pages

### Changed
- Homepage now features Search as primary call-to-action
- Public users can browse composer and work names without authentication
- Full details require sign-in/sign-up (foundation for subscription model)

### Technical
- Uses `public_min_composers` and `public_min_works` RPC functions
- Public client created with anon key for unauthenticated access
- Tab-based filtering (All/Composers/Works) with result counts
- Responsive design with proper loading and error states

## [1.5.0] - 2025-01-27

### Added
- CSV Import Functionality with multi-step wizard
- CSV upload and parsing with PapaParse
- Field mapping UI for CSV columns to database fields
- Validation endpoint with duplicate detection
- Import execution endpoint with transactional upsert
- Auto-flag duplicates for review when not skipping
- Import results report with row-level success/failure details
- Support for importing both composers and works
- CSV Import page added to sidebar navigation

### Changed
- Import workflow now includes validation step before execution
- Duplicate handling: option to skip or auto-flag for review

### Technical
- PapaParse library for CSV parsing
- Row-level validation (years, URLs, durations, country codes)
- Integration with existing duplicate detection functions
- Activity tracking for all imports via revision table
- Error handling and validation for all supported fields

## [1.4.0] - 2025-01-27

### Added
- Location Search Integration with Google Places and Nominatim fallback
- LocationSearch component with autocomplete functionality
- Server-side caching for place lookups via place table
- API endpoints for place search (`/api/places`) and place lookup (`/api/places/[id]`)
- Birth Place and Death Place search in composer editor
- Real-time location search with debouncing and loading states

### Changed
- Composer editor now uses LocationSearch component instead of placeholder
- Place data is automatically stored in database for future lookups

### Technical
- Google Places Autocomplete integration (optional, requires API key)
- Nominatim (OpenStreetMap) fallback for free location search
- Rate limit handling with proper User-Agent headers
- Graceful fallback if one provider fails

## [1.3.0] - 2025-01-27

### Added
- Enhanced Review Queue Management UI with filtering and actions
- Filter review flags by reason (possible_duplicate, incomplete, etc.)
- Filter review flags by status (open, resolved, dismissed)
- Side-by-side comparison modal for duplicate flags
- Resolve and dismiss actions for review flags
- Merge functionality for duplicate composers and works
- API endpoints for review actions (resolve, dismiss, compare, merge)
- Activity tracking for review actions
- Entity name display in review queue
- Detailed entity information in comparison view

### Changed
- Review queue page now shows all flags with enhanced UI
- Improved review flag cards with badges and action buttons
- Better duplicate comparison with expandable full data view

### Technical
- Client component with real-time state management
- Merge API handles composer and work deduplication
- Automatic data migration when merging duplicates
- Revision logging for all review actions

## [1.2.0] - 2025-01-27

### Added
- Collapsible left sidebar navigation for admin interface
- Sidebar with icon-only collapsed mode and tooltips
- List pages for Composers (`/admin/composers`) and Works (`/admin/works`)
- Review Queue page (`/admin/review`) for managing review flags
- Keyboard shortcut (Ctrl/Cmd + B) to toggle sidebar
- Admin layout wrapper with consistent header and spacing

### Changed
- Improved admin navigation with organized menu structure
- Enhanced sidebar UX with active route highlighting
- Updated all admin pages to work with new sidebar layout
- Removed duplicate padding/layout from individual admin pages

### Technical
- Added shadcn/ui sidebar components
- Implemented responsive sidebar with mobile support
- Sidebar state persists via cookies

## [1.1.0] - 2025-01-XX

### Added
- Composer Editor page with full CRUD operations
- Activity Panel UI with pagination and filtering
- Dashboard statistics (composer/work counts, review flags)
- Recent activity preview on admin dashboard
- Local timezone display for activity timestamps

### Changed
- Enhanced admin dashboard with statistics cards
- Activity Panel now shows actual timestamps instead of relative times

## [1.0.0] - 2025-01-XX

### Added
- Initial MVP release
- Work Editor with autosave functionality
- Draft/Publish workflow for works
- Sources & Recordings management with embed support
- Composer/Publisher typeahead search
- Admin authentication with Supabase
- Database schema with comprehensive tables
- Row Level Security (RLS) policies
- API routes for admin operations
- Deployment to Vercel
- GitHub repository and project setup

### Technical
- Next.js 16 with App Router
- Supabase backend (PostgreSQL)
- shadcn/ui components
- React Hook Form with Zod validation
- TypeScript throughout

[Unreleased]: https://github.com/fdtorres1/opusgraph/compare/v1.7.5...HEAD
[1.7.5]: https://github.com/fdtorres1/opusgraph/compare/v1.7.4...v1.7.5
[1.7.4]: https://github.com/fdtorres1/opusgraph/compare/v1.7.3...v1.7.4
[1.7.3]: https://github.com/fdtorres1/opusgraph/compare/v1.7.2...v1.7.3
[1.7.2]: https://github.com/fdtorres1/opusgraph/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/fdtorres1/opusgraph/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/fdtorres1/opusgraph/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/fdtorres1/opusgraph/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/fdtorres1/opusgraph/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/fdtorres1/opusgraph/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/fdtorres1/opusgraph/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fdtorres1/opusgraph/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdtorres1/opusgraph/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdtorres1/opusgraph/releases/tag/v1.0.0

