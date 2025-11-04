// app/composers/[id]/page.tsx
import { createPublicSupabase } from "@/lib/supabase/public";
import { PublicComposerDetail } from "./public-composer-detail";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PublicComposerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = createPublicSupabase();
  const { id } = await params;

  // Get minimal composer data (public RPC - fetch all and find by ID)
  const { data: allComposers } = await supabase.rpc("public_min_composers", {
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

