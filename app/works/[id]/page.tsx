// app/works/[id]/page.tsx
import { createPublicSupabase } from "@/lib/supabase/public";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicWorkDetail } from "./public-work-detail";
import { AuthenticatedWorkDetail } from "./authenticated-work-detail";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PublicWorkPage({
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
    const { data: work, error } = await supabase
      .from("work")
      .select(`
        id, work_name, composition_year, composer_id, ensemble_id,
        instrumentation_text, duration_seconds, publisher_id, status,
        work_source(id, url, title, display_order),
        work_recording(id, url, embed_url, display_order),
        composer:composer_id(id, first_name, last_name),
        publisher:publisher_id(id, name),
        ensemble:ensemble_id(id, label)
      `)
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (error || !work) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Work Not Found</h1>
            <p className="text-zinc-600 mb-4">
              The work you're looking for doesn't exist or is not published.
            </p>
            <Button asChild variant="outline">
              <Link href="/search">Back to Search</Link>
            </Button>
          </div>
        </div>
      );
    }

    // Normalize composer, publisher, and ensemble from arrays to single objects
    const normalizedWork = {
      ...work,
      composer: Array.isArray(work.composer)
        ? (work.composer[0] || null)
        : work.composer,
      publisher: Array.isArray(work.publisher)
        ? (work.publisher[0] || null)
        : work.publisher,
      ensemble: Array.isArray(work.ensemble)
        ? (work.ensemble[0] || null)
        : work.ensemble,
    };

    return <AuthenticatedWorkDetail work={normalizedWork} />;
  }

  // User is not authenticated - show public view with sign-in prompt
  const publicSupabase = createPublicSupabase();

  // Get minimal work data (public RPC - fetch all and find by ID)
  const { data: allWorks } = await publicSupabase.rpc("public_min_works", {
    q: null,
    composer_id: null,
  });

  const work = allWorks?.find((w: any) => w.id === id);

  if (!work) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-2">Work Not Found</h1>
          <p className="text-zinc-600 mb-4">
            The work you're looking for doesn't exist or is not published.
          </p>
          <Button asChild variant="outline">
            <Link href="/search">Back to Search</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Get composer name if composer_id exists
  let composerName: string | null = null;
  if (work.composer_id) {
    const { data: allComposers } = await publicSupabase.rpc("public_min_composers", {
      q: null,
    });
    const composer = allComposers?.find((c: any) => c.id === work.composer_id);
    if (composer) {
      composerName = `${composer.first_name} ${composer.last_name}`;
    }
  }

  return <PublicWorkDetail work={work} composerName={composerName} />;
}

