// app/library/[orgSlug]/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgContext } from "@/lib/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns/format";
import {
  BookOpen,
  Music,
  AlertTriangle,
  Plus,
  Search,
  Calendar,
} from "lucide-react";

export default async function LibraryDashboard({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const result = await getOrgContext(orgSlug);

  if (!result.ok) {
    if (result.error.status === 401) {
      redirect("/auth/login");
    }
    redirect("/");
  }

  const { org, membership, supabase } = result.data;
  // For personal orgs (type 'other'), the name is already "My Library" from the DB.
  // Just use org.name directly — it works for both personal and ensemble orgs.
  const displayName = org.name;
  const canManageEntries = ["owner", "manager"].includes(membership.role);

  // Fetch all stats in parallel (same queries as the stats API)
  const [
    entriesTotal,
    entriesConditions,
    performancesTotal,
    recentEntries,
    recentPerformances,
  ] = await Promise.all([
    supabase
      .from("library_entry")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id),

    supabase
      .from("library_entry")
      .select("condition")
      .eq("organization_id", org.id),

    supabase
      .from("performance")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id),

    supabase
      .from("library_entry")
      .select("id, overrides, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("performance")
      .select("id, event_name, date")
      .eq("organization_id", org.id)
      .order("date", { ascending: false })
      .limit(5),
  ]);

  const totalEntries = entriesTotal.count ?? 0;
  const totalPerformances = performancesTotal.count ?? 0;

  // Count entries needing attention (poor or missing condition)
  const conditions = entriesConditions.data ?? [];
  const needsAttention = conditions.filter(
    (e) => e.condition === "poor" || e.condition === "missing"
  ).length;

  const recentEntryRows = (recentEntries.data ?? []).map((entry) => ({
    id: entry.id as string,
    title:
      ((entry.overrides as Record<string, unknown>)?.title as string) ??
      "Untitled",
    created_at: entry.created_at as string,
  }));

  const recentPerformanceRows = (recentPerformances.data ?? []).map((p) => ({
    id: p.id as string,
    event_name: p.event_name as string,
    date: p.date as string,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{displayName}</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEntries}</div>
            <div className="text-xs text-zinc-500 mt-1">
              in your catalog
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
              <Music className="h-4 w-4" />
              Total Performances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPerformances}</div>
            <div className="text-xs text-zinc-500 mt-1">logged</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{needsAttention}</div>
            <div className="text-xs text-zinc-500 mt-1">
              poor or missing condition
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {canManageEntries && (
              <Button asChild>
                <Link href={`/library/${org.slug}/catalog/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/library/${org.slug}/catalog`}>
                <Search className="h-4 w-4 mr-2" />
                Search Catalog
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/library/${org.slug}/performances/new`}>
                <Calendar className="h-4 w-4 mr-2" />
                Log Performance
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Entries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Entries</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/library/${org.slug}/catalog`}>View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentEntryRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No entries yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentEntryRows.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between"
                  >
                    <Link
                      href={`/library/${org.slug}/catalog/${entry.id}`}
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {entry.title}
                    </Link>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {format(new Date(entry.created_at), "MMM d, yyyy")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Performances */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Performances</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/library/${org.slug}/performances`}>
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentPerformanceRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No performances yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentPerformanceRows.map((perf) => (
                  <li
                    key={perf.id}
                    className="flex items-center justify-between"
                  >
                    <Link
                      href={`/library/${org.slug}/performances/${perf.id}`}
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {perf.event_name}
                    </Link>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {format(new Date(perf.date), "MMM d, yyyy")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
