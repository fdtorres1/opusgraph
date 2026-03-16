// app/api/library/performances/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { PerformancePayload } from "@/lib/validators/performance";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { organization_id } = body;

  if (!organization_id) {
    return NextResponse.json(
      { error: "organization_id is required" },
      { status: 400 }
    );
  }

  // Verify user is a manager or owner for this org
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["owner", "manager"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Insufficient role for this action" },
      { status: 403 }
    );
  }

  // Validate payload
  const parsed = PerformancePayload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;

  // Insert performance row
  const { data, error } = await supabase
    .from("performance")
    .insert({
      organization_id,
      date: p.date,
      event_name: p.event_name,
      venue: p.venue ?? null,
      season: p.season ?? null,
      notes: p.notes ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Insert performance_work rows if provided
  let works: unknown[] = [];
  if (Array.isArray(p.works) && p.works.length) {
    const { data: insertedWorks } = await supabase
      .from("performance_work")
      .insert(
        p.works.map((w) => ({
          performance_id: data.id,
          library_entry_id: w.library_entry_id,
          program_order: w.program_order,
          notes: w.notes ?? null,
        }))
      )
      .select("*");
    works = insertedWorks ?? [];
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "performance",
    entity_id: data.id,
    actor_user_id: user.id,
    action: "create",
    organization_id,
    snapshot: { ...data, works },
  });

  return NextResponse.json({ id: data.id });
}
