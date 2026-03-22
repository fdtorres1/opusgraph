"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { getSafeRedirectPath } from "@/lib/auth-redirect";

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();
  const requestedRedirect = getSafeRedirectPath(searchParams.get("redirect"));
  const loginHref = requestedRedirect
    ? `/auth/login?redirect=${encodeURIComponent(requestedRedirect)}`
    : "/auth/login";

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // This should be consumed by the Supabase email template and forwarded to
        // `/auth/confirm?token_hash=...&type=...&redirect_to={{ .RedirectTo }}`.
        emailRedirectTo: requestedRedirect
          ? new URL(requestedRedirect, window.location.origin).toString()
          : undefined,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-sm dark:bg-zinc-800">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Check your email</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              We&apos;ve sent you a confirmation link at {email}. Click the link to confirm your account.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href={loginHref}>Back to Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-sm dark:bg-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Sign Up</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Create an account to access OpusGraph
          </p>
        </div>
        <form onSubmit={handleSignUp} className="space-y-4">
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
              minLength={6}
            />
            <p className="text-xs text-zinc-500">Must be at least 6 characters</p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </form>
        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            Sign in
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
