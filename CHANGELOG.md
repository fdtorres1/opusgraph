# Changelog

All notable changes to OpusGraph will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Review Queue Management
- CSV Import Functionality
- Public Search Interface
- Location Search Integration
- Stripe Integration

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

[Unreleased]: https://github.com/fdtorres1/opusgraph/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/fdtorres1/opusgraph/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/fdtorres1/opusgraph/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/fdtorres1/opusgraph/releases/tag/v1.0.0

