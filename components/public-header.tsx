"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function PublicHeader() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
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

