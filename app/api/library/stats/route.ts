// app/api/library/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = new URL(request.url).searchParams.get("organization_id");
  if (!orgId) {
    return NextResponse.json(
      { error: "organization_id required" },
      { status: 400 }
    );
  }

  // Verify membership (any role can view stats)
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Run all queries in parallel
  const [
    entriesTotal,
    entriesConditions,
    performancesTotal,
    recentEntries,
    recentPerformances,
  ] = await Promise.all([
    // Total library entries count
    supabase
      .from("library_entry")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),

    // All entries with just the condition column (for JS-side grouping)
    supabase
      .from("library_entry")
      .select("condition")
      .eq("organization_id", orgId),

    // Total performances count
    supabase
      .from("performance")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),

    // 5 most recent library entries
    supabase
      .from("library_entry")
      .select("id, overrides, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),

    // 5 most recent performances
    supabase
      .from("performance")
      .select("id, event_name, date")
      .eq("organization_id", orgId)
      .order("date", { ascending: false })
      .limit(5),
  ]);

  // Count entries by condition in JS
  const conditions = entriesConditions.data || [];
  const byCondition = {
    excellent: conditions.filter((e) => e.condition === "excellent").length,
    good: conditions.filter((e) => e.condition === "good").length,
    fair: conditions.filter((e) => e.condition === "fair").length,
    poor: conditions.filter((e) => e.condition === "poor").length,
    missing: conditions.filter((e) => e.condition === "missing").length,
    unset: conditions.filter((e) => e.condition === null).length,
  };

  // Map recent entries to extract title from overrides JSONB
  const mappedRecentEntries = (recentEntries.data || []).map((entry) => ({
    id: entry.id,
    title: (entry.overrides as Record<string, unknown>)?.title ?? null,
    created_at: entry.created_at,
  }));

  return NextResponse.json({
    entries: {
      total: entriesTotal.count || 0,
      byCondition,
    },
    performances: {
      total: performancesTotal.count || 0,
    },
    recentEntries: mappedRecentEntries,
    recentPerformances: recentPerformances.data || [],
  });
}
