// app/api/library/entries/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { LibraryEntryPayload } from "@/lib/validators/library-entry";
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

  // Fetch entry with joined reference data, parts, and tags
  const { data: entry, error } = await supabase
    .from("library_entry")
    .select(
      `
      *,
      work:reference_work_id (
        work_name,
        instrumentation_text,
        duration_seconds,
        composition_year,
        composer:composer_id ( first_name, last_name ),
        publisher:publisher_id ( name )
      ),
      library_entry_part ( * ),
      library_entry_tag ( library_tag ( * ) )
    `
    )
    .eq("id", id)
    .order("part_name", {
      referencedTable: "library_entry_part",
      ascending: true,
    })
    .single();

  if (error || !entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is a member of the entry's org
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", entry.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ entry });
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

  // Fetch existing entry to get organization_id
  const { data: entry } = await supabase
    .from("library_entry")
    .select("*")
    .eq("id", id)
    .single();

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is manager or owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", entry.organization_id)
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
  const parsed = LibraryEntryPayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;

  // Update library_entry fields
  const updateFields: Record<string, unknown> = {
    overrides: p.overrides,
    copies_owned: p.copies_owned,
    location: p.location ?? null,
    condition: p.condition ?? null,
    notes: p.notes ?? null,
    reference_work_id: p.reference_work_id ?? null,
  };

  const { data: updated, error: upErr } = await supabase
    .from("library_entry")
    .update(updateFields)
    .eq("id", id)
    .select("*")
    .single();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // Replace parts (delete + reinsert pattern)
  let parts: unknown[] = [];
  if (Array.isArray(p.parts)) {
    await supabase
      .from("library_entry_part")
      .delete()
      .eq("library_entry_id", id);

    if (p.parts.length) {
      const { data: insertedParts } = await supabase
        .from("library_entry_part")
        .insert(
          p.parts.map((part) => ({
            library_entry_id: id,
            part_name: part.part_name,
            quantity: part.quantity,
            condition: part.condition ?? null,
            notes: part.notes ?? null,
          }))
        )
        .select("*");
      parts = insertedParts ?? [];
    }
  } else {
    // Fetch existing parts for the snapshot
    const { data: existingParts } = await supabase
      .from("library_entry_part")
      .select("*")
      .eq("library_entry_id", id);
    parts = existingParts ?? [];
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "library_entry",
    entity_id: id,
    actor_user_id: user.id,
    action: "update",
    organization_id: entry.organization_id,
    snapshot: { ...updated, parts },
  });

  return NextResponse.json({ ok: true, entry: updated });
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

  // Fetch entry before deletion
  const { data: entry, error: fetchError } = await supabase
    .from("library_entry")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is manager or owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", entry.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["owner", "manager"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch parts for the snapshot before deletion
  const { data: parts } = await supabase
    .from("library_entry_part")
    .select("*")
    .eq("library_entry_id", id);

  // Delete entry (cascade handles parts, tags, etc.)
  const { error: deleteError } = await supabase
    .from("library_entry")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "library_entry",
    entity_id: id,
    actor_user_id: user.id,
    action: "delete",
    organization_id: entry.organization_id,
    snapshot: { ...entry, parts: parts ?? [] },
  });

  return NextResponse.json({
    ok: true,
    message: "Library entry deleted successfully",
  });
}
