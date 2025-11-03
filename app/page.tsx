import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
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
            <Link href="/admin/works/new">Admin Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="https://github.com/fdtorres1/opusgraph" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </Link>
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
