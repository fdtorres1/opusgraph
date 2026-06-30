// app/works/page.tsx
import { createPublicSupabase } from "@/lib/supabase/public";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/public-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Music, ArrowLeft } from "lucide-react";
import { WORK_TIER_LABELS, type PublicWorkTier } from "@/lib/public-index/confidence";

type PublicWorkListRow = {
  id: string;
  work_name: string | null;
  composer_first_name?: string | null;
  composer_last_name?: string | null;
  public_tier?: PublicWorkTier | null;
};

export default async function BrowseWorksPage() {
  // Check if user is authenticated
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  // Fetch all published works
  const publicSupabase = createPublicSupabase();
  const { data: works, error } = await publicSupabase.rpc("public_min_works", {
    q: null,
    composer_id: null,
  });

  if (error) {
    return (
      <>
        {isAuthenticated && <PublicHeader />}
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Error Loading Works</h1>
            <p className="text-zinc-600">Please try again later.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {isAuthenticated && <PublicHeader />}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/search">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Link>
          </Button>
          <h1 className="text-4xl font-bold mb-2">All Works</h1>
          <p className="text-zinc-600">
            {works?.length || 0} {works?.length === 1 ? "work" : "works"} found
          </p>
        </div>

        {works && works.length > 0 ? (
          <div className="grid gap-3">
            {(works as PublicWorkListRow[]).map((work) => {
              const workName = work.work_name?.trim() || "(Untitled Work)";
              const publicTier = work.public_tier as PublicWorkTier | undefined;
              const composerName = [work.composer_first_name, work.composer_last_name]
                .filter(Boolean)
                .join(" ");

              return (
                <Card key={work.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/works/${work.id}`}
                          className="hover:underline font-medium flex items-center gap-2"
                        >
                          <Music className="h-4 w-4 shrink-0 text-zinc-400" />
                          <span className="truncate">{workName}</span>
                        </Link>
                        {composerName && (
                          <p className="ml-6 mt-1 text-sm text-zinc-600">{composerName}</p>
                        )}
                      </div>
                      {publicTier && (
                        <Badge className="shrink-0" variant="outline">
                          {WORK_TIER_LABELS[publicTier]}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-500">
            <p>No works found.</p>
          </div>
        )}
      </div>
    </>
  );
}
