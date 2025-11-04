# Populate Composers Scripts

These scripts help you populate test composers into the database to verify everything is working correctly.

## Option 1: Direct Database Script (Recommended)

This script connects directly to Supabase using the service role key, bypassing RLS and authentication.

**Prerequisites:**
- Create `scripts/populate-composers.env.local` file with your credentials:
  - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (get from Supabase Dashboard → Settings → API → service_role key)

**Run:**
```bash
npm run populate-composers
```

The script will automatically load environment variables from `scripts/populate-composers.env.local`.
This keeps local script variables separate from your Vercel deployment variables.

## Option 2: API Script

This script uses the API endpoints, which requires authentication. This is useful for testing the API layer.

**Prerequisites:**
- Your Next.js dev server must be running (`npm run dev`)
- You need to be logged in (get session cookie from browser)

**Run:**
```bash
# After logging in, copy your session cookie from browser dev tools
# Then set it as an environment variable:
SESSION_COOKIE="your-session-cookie-here" npm run populate-composers-api
```

Or manually:
```bash
API_BASE_URL=http://localhost:3000 SESSION_COOKIE=your-cookie npx tsx scripts/populate-composers-api.ts
```

## What These Scripts Do

Both scripts will populate 10 test composers:
- Johann Sebastian Bach
- Wolfgang Amadeus Mozart
- Ludwig van Beethoven
- Clara Schumann
- Frédéric Chopin
- Pyotr Ilyich Tchaikovsky
- Igor Stravinsky
- Aaron Copland
- Duke Ellington
- Hildegard von Bingen

Each composer includes:
- Name (first_name, last_name)
- Birth and death years
- Nationalities (country codes)
- Wikipedia links
- Published status

## Notes

- Make sure you have the required countries in your database (DE, AT, PL, FR, RU, US)
- The scripts will skip missing countries with a warning
- All composers are set to "published" status by default

