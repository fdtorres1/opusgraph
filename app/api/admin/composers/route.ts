// app/api/admin/composers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // minimal draft row
  const { data, error } = await supabase
    .from("composer")
    .insert({ status: "draft", first_name: "", last_name: "" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Revision: create
  await supabase.from("revision").insert({
    entity_type: "composer",
    entity_id: data.id,
    actor_user_id: user.id,
    action: "create",
    snapshot: data
  });

  return NextResponse.json({ id: data.id });
}

