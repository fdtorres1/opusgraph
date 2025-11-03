// app/api/admin/works/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { WorkPayload } from "@/lib/validators/work";
import { z } from "zod";
import { detectRecording } from "@/lib/recording";

const Id = z.string().uuid();

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServerSupabase();
  const { id } = await params;

  const { data, error } = await supabase
    .from("work")
    .select(`
      id, work_name, composition_year, composer_id,
      ensemble_id, instrumentation_text, duration_seconds,
      publisher_id, status, created_at, updated_at,
      work_source(*),
      work_recording(*),
      composer:composer_id ( id, first_name, last_name ),
      publisher:publisher_id ( id, name ),
      ensemble:ensemble_id ( id, label )
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ work: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    Id.parse(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = WorkPayload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;

  // convert duration to seconds
  let duration_seconds: number | null | undefined = undefined;
  if (p.duration != null) {
    const parts = p.duration.split(":").map(Number);
    duration_seconds = parts.length === 2 ? parts[0]*60 + parts[1] : parts[0]*3600 + parts[1] * 60 + parts[2];
  }

  // Begin: update parent row
  const updateFields: Record<string, any> = {
    work_name: p.work_name ?? undefined,
    composition_year: p.composition_year ? parseInt(p.composition_year) : null,
    composer_id: p.composer_id ?? null,
    ensemble_id: p.ensemble_id ?? null,
    instrumentation_text: p.instrumentation_text ?? null,
    duration_seconds: duration_seconds ?? null,
    publisher_id: p.publisher_id ?? null,
    status: p.status ?? undefined,
  };

  const { data: before } = await supabase.from("work").select("*").eq("id", id).single();

  const { data: updated, error: upErr } = await supabase
    .from("work")
    .update(updateFields)
    .eq("id", id)
    .select("*")
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Replace sources (simple sync)
  if (Array.isArray(p.sources)) {
    await supabase.from("work_source").delete().eq("work_id", id);
    if (p.sources.length) {
      await supabase.from("work_source").insert(
        p.sources.map((s, i) => ({
          work_id: id,
          url: s.url,
          title: s.title ?? null,
          display_order: s.display_order ?? i
        }))
      );
    }
  }

  // Replace recordings (detect provider)
  if (Array.isArray(p.recordings)) {
    await supabase.from("work_recording").delete().eq("work_id", id);
    if (p.recordings.length) {
      const rows = p.recordings.map((r, i) => {
        const info = detectRecording(r.url);
        return {
          work_id: id,
          url: r.url,
          provider: info?.provider ?? 'other',
          provider_key: info?.key ?? null,
          embed_url: info?.embedUrl ?? null,
          display_order: r.display_order ?? i
        };
      });
      await supabase.from("work_recording").insert(rows);
    }
  }

  // Log revision (publish/unpublish vs update)
  const action =
    before?.status !== updated.status && updated.status === "published" ? "publish" :
    before?.status !== updated.status && updated.status === "draft" ? "unpublish" :
    "update";

  await supabase.from("revision").insert({
    entity_type: "work",
    entity_id: id,
    actor_user_id: user.id,
    action,
    snapshot: updated
  });

  return NextResponse.json({ ok: true, work: updated });
}

