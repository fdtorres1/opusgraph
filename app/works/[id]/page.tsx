// app/works/[id]/page.tsx
import { createPublicSupabase } from "@/lib/supabase/public";
import { PublicWorkDetail } from "./public-work-detail";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PublicWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = createPublicSupabase();
  const { id } = await params;

  // Get minimal work data (public RPC - fetch all and find by ID)
  const { data: allWorks } = await supabase.rpc("public_min_works", {
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
    const { data: allComposers } = await supabase.rpc("public_min_composers", {
      q: null,
    });
    const composer = allComposers?.find((c: any) => c.id === work.composer_id);
    if (composer) {
      composerName = `${composer.first_name} ${composer.last_name}`;
    }
  }

  return <PublicWorkDetail work={work} composerName={composerName} />;
}

