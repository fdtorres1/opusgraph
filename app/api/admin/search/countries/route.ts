// app/api/admin/search/countries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const q = new URL(req.url).searchParams.get("q") ?? "";

  const { data, error } = await supabase
    .from("country")
    .select("iso2, name")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ results: data?.map(c => ({ id: c.iso2, label: c.name })) ?? [] });
}

