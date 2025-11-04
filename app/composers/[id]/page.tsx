// app/composers/[id]/page.tsx
import { createPublicSupabase } from "@/lib/supabase/public";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicComposerDetail } from "./public-composer-detail";
import { AuthenticatedComposerDetail } from "./authenticated-composer-detail";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PublicComposerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Check if user is authenticated
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // User is authenticated - fetch full details
    const { data: composer, error } = await supabase
      .from("composer")
      .select(`
        id, first_name, last_name, birth_year, death_year, gender_id, gender_self_describe,
        birth_place:place!composer_birth_place_id_fkey(id, label),
        death_place:place!composer_death_place_id_fkey(id, label),
        composer_link(id, url, is_primary, display_order),
        composer_nationality(country_iso2)
      `)
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (error || !composer) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Composer Not Found</h1>
            <p className="text-zinc-600 mb-4">
              The composer you're looking for doesn't exist or is not published.
            </p>
            <Button asChild variant="outline">
              <Link href="/search">Back to Search</Link>
            </Button>
          </div>
        </div>
      );
    }

    // Normalize birth_place and death_place from arrays to single objects
    const normalizedComposer = {
      ...composer,
      birth_place: Array.isArray(composer.birth_place) 
        ? (composer.birth_place[0] || null)
        : composer.birth_place,
      death_place: Array.isArray(composer.death_place)
        ? (composer.death_place[0] || null)
        : composer.death_place,
    };

    return <AuthenticatedComposerDetail composer={normalizedComposer} />;
  }

  // User is not authenticated - show public view with sign-in prompt
  const publicSupabase = createPublicSupabase();
  
  // Get minimal composer data (public RPC - fetch all and find by ID)
  const { data: allComposers } = await publicSupabase.rpc("public_min_composers", {
    q: null,
  });

  const composer = allComposers?.find((c: any) => c.id === id);

  if (!composer) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-2">Composer Not Found</h1>
          <p className="text-zinc-600 mb-4">
            The composer you're looking for doesn't exist or is not published.
          </p>
          <Button asChild variant="outline">
            <Link href="/search">Back to Search</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <PublicComposerDetail composer={composer} />;
}

