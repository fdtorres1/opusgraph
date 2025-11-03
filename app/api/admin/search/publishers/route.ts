// app/api/admin/search/publishers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const q = new URL(req.url).searchParams.get("q") ?? "";

  const { data, error } = await supabase
    .from("publisher")
    .select("id, name")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ results: data?.map(p => ({ id: p.id, label: p.name })) ?? [] });
}

