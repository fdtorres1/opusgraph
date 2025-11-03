# OpusGraph

A classical music database application for discovering, preserving, and managing information about composers and their works.

## Features

- **Composer Management**: Create and manage composer profiles with biographical information, nationalities, and links
- **Work Cataloging**: Catalog musical works with detailed metadata including instrumentation, duration, recordings, and sources
- **Admin Interface**: Rich admin interface with autosave, draft/publish workflow, and activity tracking
- **Public Access**: Public users can view composer and work names; full details require subscription
- **Review System**: Automated duplicate detection and review flags for quality assurance
- **Activity Feed**: Track all changes, comments, and review flags in a centralized activity panel

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **UI**: shadcn/ui + Tailwind CSS
- **Forms**: React Hook Form + Zod validation
- **Authentication**: Supabase Auth

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
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

4. Run Supabase migrations:

If using Supabase CLI:
```bash
supabase db reset  # if empty project
supabase db push   # or: supabase db reset applies migrations
```

Or apply the migration manually in the Supabase dashboard:
- Go to SQL Editor
- Copy and paste the contents of `supabase/migrations/0001_init.sql`
- Run the migration

5. Set up your user profile:

After creating your account in Supabase Auth, set yourself as a super admin:
```sql
insert into user_profile(user_id, first_name, last_name, admin_role)
values ('<YOUR-AUTH-UUID>', 'Your Name', '', 'super_admin')
on conflict (user_id) do update set admin_role='super_admin';
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
│   ├── admin/              # Admin interface pages
│   │   └── works/         # Work editor pages
│   ├── api/               # API routes
│   │   └── admin/         # Admin API endpoints
│   └── ...
├── components/
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── supabase/          # Supabase client utilities
│   ├── validators/        # Zod schemas
│   ├── recording.ts       # Recording URL detection
│   └── duration.ts        # Duration formatting/parsing
├── supabase/
│   └── migrations/        # Database migrations
└── ...
```

## Database Schema

The application uses PostgreSQL with the following key tables:

- `composer` - Composer profiles
- `work` - Musical works
- `work_source` - Source links for works
- `work_recording` - Recording embeds (YouTube, Spotify, etc.)
- `revision` - Change history
- `review_flag` - Quality assurance flags
- `user_profile` - User roles and permissions
- `subscription` - Subscription management

See `supabase/migrations/0001_init.sql` for the complete schema.

## Admin Interface

Access the admin interface at `/admin/works/new` to create new works or `/admin/works/[id]` to edit existing works.

### Key Features:

- **Autosave**: Changes are automatically saved after 800ms of inactivity
- **Draft/Published**: Toggle between draft and published status
- **Sources & Recordings**: Add multiple sources and recordings with automatic embed detection
- **Composer/Publisher Search**: Typeahead search for linking related entities
- **Activity Tracking**: All changes are logged in the revision table

## Roadmap

- [ ] Composer editor page (mirroring work editor functionality)
- [ ] CSV import functionality with duplicate detection
- [ ] Public search interface
- [ ] Subscription management (Stripe integration)
- [ ] Team and institutional access
- [ ] Activity panel UI
- [ ] Review queue management interface
- [ ] Location search with Google Places/Nominatim
- [ ] Full-text search with PostgreSQL

## Development

### Adding New Components

Use shadcn/ui to add UI components:
```bash
npx shadcn@latest add [component-name]
```

### Database Migrations

Create new migrations in `supabase/migrations/` following the naming pattern `XXXX_description.sql`.

### Type Safety

The project uses TypeScript throughout. Run type checking:
```bash
npm run build
```

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
