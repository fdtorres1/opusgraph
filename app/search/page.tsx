// app/search/page.tsx
import { PublicSearch } from "./public-search";
import { PublicHeader } from "@/components/public-header";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SearchPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  return (
    <>
      <PublicHeader />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Search OpusGraph</h1>
          <p className="text-zinc-600 mb-4">
            {isAuthenticated 
              ? "Discover composers and their works."
              : "Discover composers and their works. Sign in to view full details."}
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/composers" className="text-blue-600 hover:underline">
              Browse All Composers
            </Link>
            <Link href="/works" className="text-blue-600 hover:underline">
              Browse All Works
            </Link>
          </div>
        </div>
        <PublicSearch />
      </div>
    </>
  );
}

