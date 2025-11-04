# Changelog

All notable changes to OpusGraph will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- CSV Import Functionality
- Public Search Interface
- Stripe Integration

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

[Unreleased]: https://github.com/fdtorres1/opusgraph/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/fdtorres1/opusgraph/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/fdtorres1/opusgraph/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/fdtorres1/opusgraph/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdtorres1/opusgraph/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdtorres1/opusgraph/releases/tag/v1.0.0

