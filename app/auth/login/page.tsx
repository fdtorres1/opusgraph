"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Check user role to determine redirect
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from("user_profile")
          .select("admin_role")
          .eq("user_id", user.id)
          .single();

        const adminRole = profile?.admin_role || "none";
        const hasAdminAccess = ["super_admin", "admin", "contributor"].includes(adminRole);

        const requestedRedirect = new URLSearchParams(window.location.search).get("redirect");
        
        // If user requested /admin but doesn't have access, redirect to search
        if (requestedRedirect?.startsWith("/admin") && !hasAdminAccess) {
          router.push("/search");
        } else if (requestedRedirect) {
          router.push(requestedRedirect);
        } else if (hasAdminAccess) {
          router.push("/admin");
        } else {
          router.push("/search");
        }
      } else {
        // Fallback to search if user check fails
        router.push("/search");
      }
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-sm dark:bg-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Sign In</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to access OpusGraph admin dashboard
          </p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don't have an account?{" "}
          <Link href="/auth/signup" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            Sign up
          </Link>
        </div>
        <div className="text-center">
          <Link href="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

