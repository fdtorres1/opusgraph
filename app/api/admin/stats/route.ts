// app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();

  // Get counts
  const [composers, works, reviewFlags, recentActivity] = await Promise.all([
    supabase
      .from("composer")
      .select("id, status", { count: "exact", head: true }),
    supabase
      .from("work")
      .select("id, status", { count: "exact", head: true }),
    supabase
      .from("review_flag")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("activity_event")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(5),
  ]);

  // Count by status
  const composerCounts = await supabase
    .from("composer")
    .select("status");
  
  const workCounts = await supabase
    .from("work")
    .select("status");

  const composerDraft = composerCounts.data?.filter(c => c.status === "draft").length || 0;
  const composerPublished = composerCounts.data?.filter(c => c.status === "published").length || 0;
  const workDraft = workCounts.data?.filter(w => w.status === "draft").length || 0;
  const workPublished = workCounts.data?.filter(w => w.status === "published").length || 0;

  return NextResponse.json({
    composers: {
      total: composers.count || 0,
      draft: composerDraft,
      published: composerPublished,
    },
    works: {
      total: works.count || 0,
      draft: workDraft,
      published: workPublished,
    },
    reviewFlags: {
      open: reviewFlags.count || 0,
    },
    recentActivity: recentActivity.data || [],
  });
}

