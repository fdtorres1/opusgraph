"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut, User, BookOpen, Shield } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function PublicHeader() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [libraryUrl, setLibraryUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        // Fetch library org slug
        const { data: membership } = await supabase
          .from("org_member")
          .select("organization_id, organization:organization_id(slug)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        if (membership?.organization && typeof membership.organization === "object") {
          const org = membership.organization as unknown as { slug: string };
          if (org.slug) setLibraryUrl(`/library/${org.slug}`);
        }
        // Check admin role
        const { data: profile } = await supabase
          .from("user_profile")
          .select("admin_role")
          .eq("user_id", user.id)
          .single();
        if (profile && ["super_admin", "admin", "contributor"].includes(profile.admin_role || "")) {
          setIsAdmin(true);
        }
      }
      setLoading(false);
    }
    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/search");
    router.refresh();
  };

  // Only show header if user is authenticated
  if (loading || !user) {
    return null;
  }

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/search" className="text-xl font-bold hover:underline">
              OpusGraph
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/search" className="text-sm text-zinc-600 hover:text-zinc-900">
                Search
              </Link>
              <Link href="/composers" className="text-sm text-zinc-600 hover:text-zinc-900">
                Composers
              </Link>
              <Link href="/works" className="text-sm text-zinc-600 hover:text-zinc-900">
                Works
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {libraryUrl && (
              <Link href={libraryUrl} className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                My Library
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            <span className="text-sm text-zinc-600 flex items-center gap-2">
              <User className="h-4 w-4" />
              {user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

