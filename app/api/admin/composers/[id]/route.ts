// app/api/admin/composers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ComposerPayload } from "@/lib/validators/composer";
import { z } from "zod";

const Id = z.string().uuid();

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { id } = await params;

  const { data, error } = await supabase
    .from("composer")
    .select(`
      id, first_name, last_name, birth_year, birth_place_id,
      death_year, death_place_id, gender_id, gender_self_describe,
      status, created_at, updated_at,
      composer_link(*),
      composer_nationality(country_iso2),
      birth_place:birth_place_id ( id, label ),
      death_place:death_place_id ( id, label ),
      gender:gender_id ( id, label )
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ composer: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    Id.parse(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = ComposerPayload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;

  // Begin: update parent row
  const updateFields: Record<string, any> = {
    first_name: p.first_name?.trim() || "",
    last_name: p.last_name?.trim() || "",
    birth_year: p.birth_year ? parseInt(p.birth_year) : null,
    birth_place_id: p.birth_place_id ?? null,
    death_year: p.death_year ? parseInt(p.death_year) : null,
    death_place_id: p.death_place_id ?? null,
    gender_id: p.gender_id ?? null,
    gender_self_describe: p.gender_self_describe?.trim() || null,
    status: p.status ?? undefined,
  };

  const { data: before } = await supabase.from("composer").select("*").eq("id", id).single();

  const { data: updated, error: upErr } = await supabase
    .from("composer")
    .update(updateFields)
    .eq("id", id)
    .select("*")
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Replace nationalities
  if (Array.isArray(p.nationalities)) {
    await supabase.from("composer_nationality").delete().eq("composer_id", id);
    if (p.nationalities.length) {
      await supabase.from("composer_nationality").insert(
        p.nationalities.map((iso2) => ({
          composer_id: id,
          country_iso2: iso2
        }))
      );
    }
  }

  // Replace links
  if (Array.isArray(p.links)) {
    await supabase.from("composer_link").delete().eq("composer_id", id);
    if (p.links.length) {
      await supabase.from("composer_link").insert(
        p.links.map((link, i) => ({
          composer_id: id,
          url: link.url,
          is_primary: link.is_primary ?? false,
          display_order: link.display_order ?? i
        }))
      );
    }
  }

  // Log revision (publish/unpublish vs update)
  const action =
    before?.status !== updated.status && updated.status === "published" ? "publish" :
    before?.status !== updated.status && updated.status === "draft" ? "unpublish" :
    "update";

  await supabase.from("revision").insert({
    entity_type: "composer",
    entity_id: id,
    actor_user_id: user.id,
    action,
    snapshot: updated
  });

  return NextResponse.json({ ok: true, composer: updated });
}

