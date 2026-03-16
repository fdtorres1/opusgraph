// app/api/library/reference/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });

  const { data, error } = await supabase
    .from("work")
    .select(
      "id, work_name, instrumentation_text, duration_seconds, composition_year, composer(first_name, last_name), publisher(name)"
    )
    .eq("status", "published")
    .ilike("work_name", `%${q}%`)
    .order("work_name")
    .limit(20);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ results: data ?? [] });
}
