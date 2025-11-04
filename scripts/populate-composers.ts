// scripts/populate-composers.ts
// Script to populate test composers into the database
// Run with: npm run populate-composers
//
// This script automatically loads environment variables from scripts/populate-composers.env.local
// This keeps local env vars separate from Vercel deployment variables

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from scripts/populate-composers.env.local
// This file should contain SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL
// This keeps local env vars separate from Vercel deployment variables
const envPath = resolve(process.cwd(), 'scripts', 'populate-composers.env.local');
config({ path: envPath });

// Fallback to root .env.local if scripts file doesn't exist (for backward compatibility)
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('Please add the following to scripts/populate-composers.env.local:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('\nGet your service role key from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

// Use service role key to bypass RLS (for admin scripts)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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

async function populateComposers() {
  console.log('Starting to populate composers...\n');

  // Check if countries exist
  const { data: countries, error: countryError } = await supabase
    .from('country')
    .select('iso2')
    .in('iso2', ['US', 'GB', 'CA', 'DE', 'AT', 'PL', 'FR', 'RU']);

  if (countryError) {
    console.error('Error fetching countries:', countryError.message);
    console.log('Note: Some countries may not exist in the database. Continuing...\n');
  } else {
    const existingCountries = new Set(countries?.map(c => c.iso2) || []);
    const neededCountries = new Set<string>();
    testComposers.forEach(c => {
      c.nationalities?.forEach(nat => neededCountries.add(nat));
    });
    const missing = Array.from(neededCountries).filter(c => !existingCountries.has(c));
    if (missing.length > 0) {
      console.warn(`Warning: Missing countries: ${missing.join(', ')}`);
      console.warn('Some composers may fail to insert nationalities.\n');
    }
  }

  let successCount = 0;
  let errorCount = 0;

  for (const composer of testComposers) {
    try {
      // Insert composer
      const { data: inserted, error: insertError } = await supabase
        .from('composer')
        .insert({
          first_name: composer.first_name,
          last_name: composer.last_name,
          birth_year: composer.birth_year || null,
          death_year: composer.death_year || null,
          status: composer.status || 'draft'
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`❌ Failed to insert ${composer.first_name} ${composer.last_name}:`, insertError.message);
        errorCount++;
        continue;
      }

      const composerId = inserted.id;
      console.log(`✓ Inserted ${composer.first_name} ${composer.last_name} (ID: ${composerId})`);

      // Insert nationalities
      if (composer.nationalities && composer.nationalities.length > 0) {
        const { error: natError } = await supabase
          .from('composer_nationality')
          .insert(
            composer.nationalities.map(iso2 => ({
              composer_id: composerId,
              country_iso2: iso2
            }))
          );

        if (natError) {
          console.warn(`  ⚠️  Warning: Failed to insert nationalities:`, natError.message);
        } else {
          console.log(`  ✓ Added nationalities: ${composer.nationalities.join(', ')}`);
        }
      }

      // Insert links
      if (composer.links && composer.links.length > 0) {
        const { error: linkError } = await supabase
          .from('composer_link')
          .insert(
            composer.links.map((url, idx) => ({
              composer_id: composerId,
              url,
              is_primary: idx === 0,
              display_order: idx
            }))
          );

        if (linkError) {
          console.warn(`  ⚠️  Warning: Failed to insert links:`, linkError.message);
        } else {
          console.log(`  ✓ Added ${composer.links.length} link(s)`);
        }
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

populateComposers()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });

