// app/api/admin/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const source = searchParams.get("source"); // 'revision', 'comment', 'review_flag', or null for all
  const entityType = searchParams.get("entity_type"); // 'composer', 'work', or null for all

  // Query the view directly - views in Supabase can be queried like tables
  // RLS is handled by the underlying tables (revision, admin_comment, review_flag)
  let query = supabase
    .from("activity_event")
    .select("*")
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (source) {
    query = query.eq("source", source);
  }

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ events: data ?? [] });
}

