// app/api/library/performances/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { PerformancePayload } from "@/lib/validators/performance";
import { z } from "zod";

const Id = z.string().uuid();

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch performance with program (works ordered by program_order)
  const { data: performance, error } = await supabase
    .from("performance")
    .select(
      `
      *,
      performance_work (
        *,
        library_entry:library_entry_id (
          id,
          overrides,
          reference_work_id,
          work:reference_work_id (
            work_name,
            composer:composer_id ( first_name, last_name )
          )
        )
      )
    `
    )
    .eq("id", id)
    .order("program_order", {
      referencedTable: "performance_work",
      ascending: true,
    })
    .single();

  if (error || !performance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is a member of the performance's org
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", performance.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ performance });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    Id.parse(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch existing performance to get organization_id
  const { data: performance } = await supabase
    .from("performance")
    .select("*")
    .eq("id", id)
    .single();

  if (!performance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is manager or owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", performance.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["owner", "manager"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate request body
  const body = await req.json();
  const parsed = PerformancePayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;

  // Update performance fields
  const updateFields: Record<string, unknown> = {
    date: p.date,
    event_name: p.event_name,
    venue: p.venue ?? null,
    season: p.season ?? null,
    notes: p.notes ?? null,
  };

  const { data: updated, error: upErr } = await supabase
    .from("performance")
    .update(updateFields)
    .eq("id", id)
    .select("*")
    .single();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // Replace program works (delete + reinsert pattern)
  let works: unknown[] = [];
  if (Array.isArray(p.works)) {
    await supabase
      .from("performance_work")
      .delete()
      .eq("performance_id", id);

    if (p.works.length) {
      const { data: insertedWorks } = await supabase
        .from("performance_work")
        .insert(
          p.works.map((w) => ({
            performance_id: id,
            library_entry_id: w.library_entry_id,
            program_order: w.program_order,
            notes: w.notes ?? null,
          }))
        )
        .select("*");
      works = insertedWorks ?? [];
    }
  } else {
    // Fetch existing works for the snapshot
    const { data: existingWorks } = await supabase
      .from("performance_work")
      .select("*")
      .eq("performance_id", id);
    works = existingWorks ?? [];
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "performance",
    entity_id: id,
    actor_user_id: user.id,
    action: "update",
    organization_id: performance.organization_id,
    snapshot: { ...updated, works },
  });

  return NextResponse.json({ ok: true, performance: updated });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id } = await params;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch performance before deletion
  const { data: performance, error: fetchError } = await supabase
    .from("performance")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !performance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is manager or owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", performance.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["owner", "manager"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch program works for the snapshot before deletion
  const { data: works } = await supabase
    .from("performance_work")
    .select("*")
    .eq("performance_id", id);

  // Delete performance (cascade handles performance_work)
  const { error: deleteError } = await supabase
    .from("performance")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "performance",
    entity_id: id,
    actor_user_id: user.id,
    action: "delete",
    organization_id: performance.organization_id,
    snapshot: { ...performance, works: works ?? [] },
  });

  return NextResponse.json({
    ok: true,
    message: "Performance deleted successfully",
  });
}
