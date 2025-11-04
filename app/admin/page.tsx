// app/admin/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns/format";
import AdminDashboardClient from "./dashboard-client";

export default async function AdminDashboard() {
  const supabase = await createServerSupabase();

  // Get counts
  const [composersResult, worksResult, reviewFlagsResult, recentActivityResult] = await Promise.all([
    supabase.from("composer").select("id, status"),
    supabase.from("work").select("id, status"),
    supabase.from("review_flag").select("id").eq("status", "open"),
    supabase.from("activity_event").select("*").order("occurred_at", { ascending: false }).limit(5),
  ]);

  const composers = composersResult.data || [];
  const works = worksResult.data || [];
  const reviewFlags = reviewFlagsResult.data || [];
  const recentActivity = recentActivityResult.data || [];

  const stats = {
    composers: {
      total: composers.length,
      draft: composers.filter(c => c.status === "draft").length,
      published: composers.filter(c => c.status === "published").length,
    },
    works: {
      total: works.length,
      draft: works.filter(w => w.status === "draft").length,
      published: works.filter(w => w.status === "published").length,
    },
    reviewFlags: {
      open: reviewFlags.length,
    },
    recentActivity: recentActivity,
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total Composers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.composers.total}</div>
              <div className="text-xs text-zinc-500 mt-1">
                {stats.composers.published} published, {stats.composers.draft} draft
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.works.total}</div>
              <div className="text-xs text-zinc-500 mt-1">
                {stats.works.published} published, {stats.works.draft} draft
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Review Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.reviewFlags.open}</div>
              <div className="text-xs text-zinc-500 mt-1">awaiting review</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentActivity.length}</div>
              <div className="text-xs text-zinc-500 mt-1">last 5 events</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Composers</CardTitle>
            <CardDescription>Manage composer profiles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/admin/composers/new">Create New Composer</Link>
            </Button>
            {stats && stats.reviewFlags.open > 0 && (
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/review">
                  {stats.reviewFlags.open} Item{stats.reviewFlags.open !== 1 ? "s" : ""} Need Review
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Works</CardTitle>
            <CardDescription>Manage musical works</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/works/new">Create New Work</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Preview */}
      {stats && stats.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/activity">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <AdminDashboardClient initialActivity={stats.recentActivity} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
