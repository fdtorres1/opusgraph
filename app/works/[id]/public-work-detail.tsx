// app/works/[id]/public-work-detail.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";

type Work = {
  id: string;
  work_name: string;
  composer_id: string;
};

export function PublicWorkDetail({
  work,
  composerName,
}: {
  work: Work;
  composerName?: string | null;
}) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/search">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Link>
        </Button>
        <h1 className="text-4xl font-bold">{work.work_name || "Untitled Work"}</h1>
        {composerName && (
          <p className="text-xl text-zinc-600 mt-2">
            by <Link href={`/composers/${work.composer_id}`} className="hover:underline">{composerName}</Link>
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Full Details Available
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-zinc-600">
            Full work details, instrumentation, recordings, and sources are available to subscribers.
            Sign in or create an account to access complete information.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

