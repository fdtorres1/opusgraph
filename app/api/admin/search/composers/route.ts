// app/api/admin/search/composers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const q = new URL(req.url).searchParams.get("q") ?? "";

  const { data, error } = await supabase
    .from("composer")
    .select("id, first_name, last_name")
    .ilike("last_name", `%${q}%`)
    .order("last_name")
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ results: data?.map(c => ({ id: c.id, label: `${c.first_name} ${c.last_name}` })) ?? [] });
}

