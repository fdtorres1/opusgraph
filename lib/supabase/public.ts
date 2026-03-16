// lib/supabase/public.ts
import { createClient } from "@supabase/supabase-js";

// Public client using publishable key for unauthenticated access
export function createPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
