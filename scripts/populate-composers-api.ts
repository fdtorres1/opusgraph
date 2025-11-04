// scripts/populate-composers-api.ts
// Alternative script that uses the API endpoints (requires authentication)
// Run with: npx tsx scripts/populate-composers-api.ts
// 
// Note: This requires you to be logged in. You'll need to:
// 1. Get your session cookie from the browser after logging in
// 2. Set it as an environment variable or modify this script

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestComposer {
  first_name: string;
  last_name: string;
  birth_year?: number;
  death_year?: number;
  nationalities?: string[];
  links?: string[];
  status?: 'draft' | 'published';
}

const testComposers: TestComposer[] = [
  {
    first_name: 'Johann Sebastian',
    last_name: 'Bach',
    birth_year: 1685,
    death_year: 1750,
    nationalities: ['DE'],
    links: ['https://en.wikipedia.org/wiki/Johann_Sebastian_Bach'],
    status: 'published'
  },
  {
    first_name: 'Wolfgang Amadeus',
    last_name: 'Mozart',
    birth_year: 1756,
    death_year: 1791,
    nationalities: ['AT'],
    links: ['https://en.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart'],
    status: 'published'
  },
  {
    first_name: 'Ludwig van',
    last_name: 'Beethoven',
    birth_year: 1770,
    death_year: 1827,
    nationalities: ['DE'],
    links: ['https://en.wikipedia.org/wiki/Ludwig_van_Beethoven'],
    status: 'published'
  },
  {
    first_name: 'Clara',
    last_name: 'Schumann',
    birth_year: 1819,
    death_year: 1896,
    nationalities: ['DE'],
    links: ['https://en.wikipedia.org/wiki/Clara_Schumann'],
    status: 'published'
  },
  {
    first_name: 'Frédéric',
    last_name: 'Chopin',
    birth_year: 1810,
    death_year: 1849,
    nationalities: ['PL', 'FR'],
    links: ['https://en.wikipedia.org/wiki/Frédéric_Chopin'],
    status: 'published'
  },
  {
    first_name: 'Pyotr Ilyich',
    last_name: 'Tchaikovsky',
    birth_year: 1840,
    death_year: 1893,
    nationalities: ['RU'],
    links: ['https://en.wikipedia.org/wiki/Pyotr_Ilyich_Tchaikovsky'],
    status: 'published'
  },
  {
    first_name: 'Igor',
    last_name: 'Stravinsky',
    birth_year: 1882,
    death_year: 1971,
    nationalities: ['RU', 'US'],
    links: ['https://en.wikipedia.org/wiki/Igor_Stravinsky'],
    status: 'published'
  },
  {
    first_name: 'Aaron',
    last_name: 'Copland',
    birth_year: 1900,
    death_year: 1990,
    nationalities: ['US'],
    links: ['https://en.wikipedia.org/wiki/Aaron_Copland'],
    status: 'published'
  },
  {
    first_name: 'Duke',
    last_name: 'Ellington',
    birth_year: 1899,
    death_year: 1974,
    nationalities: ['US'],
    links: ['https://en.wikipedia.org/wiki/Duke_Ellington'],
    status: 'published'
  },
  {
    first_name: 'Hildegard',
    last_name: 'von Bingen',
    birth_year: 1098,
    death_year: 1179,
    nationalities: ['DE'],
    links: ['https://en.wikipedia.org/wiki/Hildegard_of_Bingen'],
    status: 'published'
  }
];

async function populateViaAPI(sessionCookie?: string) {
  console.log('Starting to populate composers via API...\n');
  console.log('Note: This requires authentication. Make sure you have a valid session.\n');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const composer of testComposers) {
    try {
      // Step 1: Create draft composer
      const createRes = await fetch(`${API_BASE_URL}/api/admin/composers`, {
        method: 'POST',
        headers,
      });

      if (!createRes.ok) {
        const error = await createRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`❌ Failed to create ${composer.first_name} ${composer.last_name}:`, error.error || createRes.statusText);
        errorCount++;
        continue;
      }

      const { id: composerId } = await createRes.json();
      console.log(`✓ Created draft for ${composer.first_name} ${composer.last_name} (ID: ${composerId})`);

      // Step 2: Update with full details
      const updatePayload = {
        first_name: composer.first_name,
        last_name: composer.last_name,
        birth_year: composer.birth_year?.toString() || null,
        death_year: composer.death_year?.toString() || null,
        nationalities: composer.nationalities || [],
        links: composer.links?.map((url, idx) => ({
          url,
          is_primary: idx === 0,
          display_order: idx
        })) || [],
        status: composer.status || 'draft'
      };

      const updateRes = await fetch(`${API_BASE_URL}/api/admin/composers/${composerId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updatePayload),
      });

      if (!updateRes.ok) {
        const error = await updateRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`❌ Failed to update ${composer.first_name} ${composer.last_name}:`, error.error || updateRes.statusText);
        errorCount++;
        continue;
      }

      console.log(`  ✓ Updated with details`);
      if (composer.nationalities?.length) {
        console.log(`  ✓ Added nationalities: ${composer.nationalities.join(', ')}`);
      }
      if (composer.links?.length) {
        console.log(`  ✓ Added ${composer.links.length} link(s)`);
      }

      successCount++;
    } catch (error: any) {
      console.error(`❌ Error processing ${composer.first_name} ${composer.last_name}:`, error.message);
      errorCount++;
    }
    console.log('');
  }

  console.log('\n=== Summary ===');
  console.log(`✓ Successfully inserted: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`Total: ${testComposers.length}`);
}

// You can pass a session cookie via environment variable
const sessionCookie = process.env.SESSION_COOKIE;
populateViaAPI(sessionCookie)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    console.error('\nNote: If you get authentication errors, you may need to:');
    console.error('1. Log in to the app in your browser');
    console.error('2. Copy the session cookie from your browser');
    console.error('3. Set it as SESSION_COOKIE environment variable');
    console.error('4. Or use the direct database script instead: populate-composers.ts');
    process.exit(1);
  });

