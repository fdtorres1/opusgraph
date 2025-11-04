// app/api/admin/composers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ComposerPayload } from "@/lib/validators/composer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("user_profile").select("admin_role").eq("user_id", user.id).single();
  if (!profile || !["super_admin", "admin", "contributor"].includes(profile.admin_role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: composer, error } = await supabase
    .from("composer")
    .select(`
      *,
      composer_nationality:composer_nationality(country_iso2),
      composer_link:composer_link(id, url, is_primary, display_order),
      birth_place:place!composer_birth_place_id_fkey(id, label),
      death_place:place!composer_death_place_id_fkey(id, label)
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    composer: {
      ...composer,
      nationality: (composer.composer_nationality || [])[0]?.country_iso2 ?? null,
      links: (composer.composer_link || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("user_profile").select("admin_role").eq("user_id", user.id).single();
  if (!profile || !["super_admin", "admin", "contributor"].includes(profile.admin_role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  
  // Validate payload
  const validation = ComposerPayload.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.flatten() },
      { status: 400 }
    );
  }
  
  const p = validation.data;
  const before = await supabase.from("composer").select("status").eq("id", id).single().then(r => r.data);

  // Ensure at least one name is provided (trimmed)
  const firstName = (p.first_name?.trim() || "").trim();
  const lastName = (p.last_name?.trim() || "").trim();
  
  if (!firstName && !lastName) {
    return NextResponse.json(
      { error: "At least one of first_name or last_name must be provided" },
      { status: 400 }
    );
  }

  const { data: updated, error: upErr } = await supabase
    .from("composer")
    .update({
      first_name: firstName || "",
      last_name: lastName || "",
      birth_year: p.birth_year ? parseInt(p.birth_year, 10) : null,
      birth_place_id: p.birth_place_id || null,
      death_year: p.death_year ? parseInt(p.death_year, 10) : null,
      death_place_id: p.death_place_id || null,
      gender_id: p.gender_id || null,
      gender_self_describe: p.gender_self_describe || null,
      status: p.status,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Replace nationality (single country)
  await supabase.from("composer_nationality").delete().eq("composer_id", id);
  if (p.nationality) {
    await supabase.from("composer_nationality").insert({
      composer_id: id,
      country_iso2: p.nationality,
    });
  }

  // Replace links
  if (Array.isArray(p.links)) {
    await supabase.from("composer_link").delete().eq("composer_id", id);
    if (p.links.length) {
      await supabase.from("composer_link").insert(
        p.links.map((link: any, i: number) => ({
          composer_id: id,
          url: link.url,
          is_primary: link.is_primary || false,
          display_order: link.display_order ?? i,
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
    snapshot: updated,
  });

  return NextResponse.json({ ok: true, composer: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("user_profile").select("admin_role").eq("user_id", user.id).single();
  if (!profile || !["super_admin", "admin"].includes(profile.admin_role)) {
    return NextResponse.json({ error: "Forbidden: Only admins can delete" }, { status: 403 });
  }

  // Check if composer exists
  const { data: composer, error: fetchError } = await supabase
    .from("composer")
    .select("id, first_name, last_name")
    .eq("id", id)
    .single();

  if (fetchError || !composer) {
    return NextResponse.json({ error: "Composer not found" }, { status: 404 });
  }

  // Delete composer (cascade will handle related records)
  const { error: deleteError } = await supabase
    .from("composer")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Log deletion as revision
  await supabase.from("revision").insert({
    entity_type: "composer",
    entity_id: id,
    actor_user_id: user.id,
    action: "delete",
    snapshot: composer,
  });

  return NextResponse.json({ ok: true, message: "Composer deleted successfully" });
}
