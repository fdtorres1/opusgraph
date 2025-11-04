// app/works/page.tsx
import { createPublicSupabase } from "@/lib/supabase/public";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/public-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Music, ArrowLeft } from "lucide-react";

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
            {works.map((work: any) => {
              const workName = work.work_name?.trim() || "(Untitled Work)";

              return (
                <Card key={work.id}>
                  <CardContent className="p-4">
                    <Link
                      href={`/works/${work.id}`}
                      className="hover:underline font-medium flex items-center gap-2"
                    >
                      <Music className="h-4 w-4 text-zinc-400" />
                      {workName}
                    </Link>
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

