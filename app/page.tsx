import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  // If the user is authenticated, redirect them to their library or admin
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Check if platform admin
    const { data: profile } = await supabase
      .from("user_profile")
      .select("admin_role")
      .eq("user_id", user.id)
      .single();

    const adminRole = profile?.admin_role || "none";
    const hasAdminAccess = ["super_admin", "admin", "contributor"].includes(adminRole);

    if (hasAdminAccess) {
      redirect("/admin");
    }

    // Find user's first org membership and redirect to library
    const { data: membership } = await supabase
      .from("org_member")
      .select("organization_id, organization:organization_id(slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (membership?.organization && typeof membership.organization === "object") {
      const org = membership.organization as unknown as { slug: string };
      if (org.slug) {
        redirect(`/library/${org.slug}`);
      }
    }

    // Fallback if no org found (shouldn't happen)
    redirect("/search");
  }

  // Unauthenticated users see the landing page
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-16 text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          OpusGraph
        </h1>
        <p className="mb-8 max-w-2xl mx-auto text-xl text-zinc-600 dark:text-zinc-400">
          A classical music database for discovering, preserving, and managing information about composers and their works.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/search">Search</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
        </div>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Composer Management</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create and manage composer profiles with biographical information and links.
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Work Cataloging</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Catalog musical works with detailed metadata, recordings, and sources.
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-50">Admin Interface</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Rich admin interface with autosave, draft/publish workflow, and activity tracking.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
