// app/composers/page.tsx
import { createPublicSupabase } from "@/lib/supabase/public";
import { createServerSupabase } from "@/lib/supabase/server";
import { PublicHeader } from "@/components/public-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User, ArrowLeft } from "lucide-react";

export default async function BrowseComposersPage() {
  // Check if user is authenticated
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  // Fetch all published composers
  const publicSupabase = createPublicSupabase();
  const { data: composers, error } = await publicSupabase.rpc("public_min_composers", {
    q: null,
  });

  if (error) {
    return (
      <>
        {isAuthenticated && <PublicHeader />}
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Error Loading Composers</h1>
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
          <h1 className="text-4xl font-bold mb-2">All Composers</h1>
          <p className="text-zinc-600">
            {composers?.length || 0} {composers?.length === 1 ? "composer" : "composers"} found
          </p>
        </div>

        {composers && composers.length > 0 ? (
          <div className="grid gap-3">
            {composers.map((composer: any) => {
              const firstName = composer.first_name?.trim() || "";
              const lastName = composer.last_name?.trim() || "";
              const displayName = firstName || lastName
                ? `${firstName} ${lastName}`.trim()
                : "(Untitled)";

              return (
                <Card key={composer.id}>
                  <CardContent className="p-4">
                    <Link
                      href={`/composers/${composer.id}`}
                      className="hover:underline font-medium flex items-center gap-2"
                    >
                      <User className="h-4 w-4 text-zinc-400" />
                      {displayName}
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-500">
            <p>No composers found.</p>
          </div>
        )}
      </div>
    </>
  );
}

