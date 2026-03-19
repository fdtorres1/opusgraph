# OpusGraph

A cloud-based platform for ensemble music library management, powered by a curated classical music reference database.

OpusGraph helps orchestras, choirs, bands, and other performing ensembles catalog their sheet music, track parts and copies, manage performance history, and plan seasons — replacing the spreadsheets that most organizations rely on today.

**Live Site**: [https://opusgraph.vercel.app](https://opusgraph.vercel.app)

## Features

### Library Management
- **Catalog sheet music**: Title, composer, arranger, publisher, instrumentation, copies owned, physical location, condition
- **Track parts**: Structured part-by-part tracking with quantity and condition per part
- **Performance history**: Log concerts and services with full programs, track when each piece was last performed
- **Multi-field search**: Search and filter by any combination of title, composer, instrumentation, condition, location, tags
- **CSV import**: Migrate from Google Sheets or Excel with column mapping and duplicate detection
- **Tags & categories**: Organize by season, genre, difficulty, or custom categories

### Reference Database
- **Auto-populate**: Type a work title and OpusGraph suggests matches from its reference database, auto-filling instrumentation, duration, and publisher
- **Composer profiles**: Biographical data, nationalities, external links
- **Work catalog**: Instrumentation, recordings, sources, publication details
- **Review system**: Duplicate detection and quality assurance flags

### Multi-Tenant
- **Organizations**: Each ensemble gets its own isolated library
- **Roles**: Owner, manager (full edit), and member (read-only, can comment) per organization
- **Individual accounts**: Auto-created personal org ("My Library") — same features, no "organization" language
- **Billing**: Organization-level or individual subscriptions

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL) with Row-Level Security
- **UI**: shadcn/ui + Tailwind CSS 4
- **Forms**: React Hook Form + Zod validation
- **Auth**: Supabase Auth with two-layer role system

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- (Optional) Google Places API key for location search

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd opusgraph
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

4. Run database migrations:

Apply migrations in order from `supabase/migrations/`. If using Supabase CLI:
```bash
supabase db push
```

Or apply manually via the Supabase dashboard SQL Editor.

5. Set up your admin account:

After creating your account in Supabase Auth, set yourself as a super admin:
```sql
INSERT INTO user_profile(user_id, first_name, last_name, admin_role)
VALUES ('<YOUR-AUTH-UUID>', 'Your Name', '', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET admin_role = 'super_admin';
```

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
opusgraph/
├── app/
│   ├── admin/              # Reference DB admin interface
│   ├── library/            # Library management (org-scoped)
│   ├── api/
│   │   ├── admin/          # Reference DB API endpoints
│   │   └── library/        # Library management API endpoints
│   ├── auth/               # Authentication pages
│   ├── composers/          # Public composer pages
│   ├── works/              # Public work pages
│   └── search/             # Public search
├── components/
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── supabase/           # Supabase client utilities
│   └── validators/         # Zod schemas
├── docs/
│   ├── ACTIVE_CONTEXT.md   # Current handoff state for the next session
│   ├── ARCHITECTURE.md     # System design and decisions
│   ├── DECISIONS.md        # Durable product and architecture decisions
│   ├── ROADMAP.md          # Current priorities and sequencing
│   ├── SCHEMA.md           # Database table specifications
│   ├── WORKLOG.md          # Append-only implementation log
│   └── specs/             # Focused specs for nontrivial initiatives
├── supabase/
│   └── migrations/         # Database migrations
└── ...
```

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** — End-user guide for library management and Works Database admin
- **[Architecture](docs/ARCHITECTURE.md)** — System design, two-layer auth, multi-tenancy, data model
- **[Schema](docs/SCHEMA.md)** — Database table specifications for library management
- **[Roadmap](docs/ROADMAP.md)** — Current priorities and sequencing
- **[Decisions](docs/DECISIONS.md)** — Durable product and architecture decisions
- **[Worklog](docs/WORKLOG.md)** — Append-only implementation and investigation history
- **[Active Context](docs/ACTIVE_CONTEXT.md)** — Canonical current-state handoff for the next session
- **[Specs](docs/specs/README.md)** — Focused specs for nontrivial initiatives

## Development

### Adding UI Components
```bash
npx shadcn@latest add [component-name]
```

### Database Migrations
Create new migrations in `supabase/migrations/` following the naming pattern `XXXX_description.sql`.

### Type Checking
```bash
npm run build
```

## License

[Add your license here]
