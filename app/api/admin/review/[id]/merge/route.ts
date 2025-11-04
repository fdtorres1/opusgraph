// app/api/admin/review/[id]/merge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id: flagId } = await params;
    const { entity_type, primary_id, duplicate_id } = await req.json();

    if (!entity_type || !primary_id || !duplicate_id) {
      return NextResponse.json(
        { error: "Missing required fields: entity_type, primary_id, duplicate_id" },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the review flag
    const { data: flag } = await supabase
      .from("review_flag")
      .select("*")
      .eq("id", flagId)
      .single();

    if (!flag) {
      return NextResponse.json(
        { error: "Review flag not found" },
        { status: 404 }
      );
    }

    // Merge entities based on type
    if (entity_type === "composer") {
      // Merge composer: move all related data from duplicate to primary
      // 1. Update works that reference the duplicate composer
      await supabase
        .from("work")
        .update({ composer_id: primary_id })
        .eq("composer_id", duplicate_id);

      // 2. Merge composer_nationality (keep unique)
      const { data: dupNationalities } = await supabase
        .from("composer_nationality")
        .select("country_iso2")
        .eq("composer_id", duplicate_id);

      if (dupNationalities) {
        for (const nat of dupNationalities) {
          // Check if already exists
          const { data: existing } = await supabase
            .from("composer_nationality")
            .select("composer_id")
            .eq("composer_id", primary_id)
            .eq("country_iso2", nat.country_iso2)
            .single();
          
          if (!existing) {
            await supabase
              .from("composer_nationality")
              .insert({
                composer_id: primary_id,
                country_iso2: nat.country_iso2,
              });
          }
        }
      }

      // 3. Merge composer_link (keep unique URLs)
      const { data: dupLinks } = await supabase
        .from("composer_link")
        .select("*")
        .eq("composer_id", duplicate_id);

      if (dupLinks) {
        for (const link of dupLinks) {
          // Check if already exists
          const { data: existing } = await supabase
            .from("composer_link")
            .select("id")
            .eq("composer_id", primary_id)
            .eq("url", link.url)
            .single();
          
          if (!existing) {
            await supabase
              .from("composer_link")
              .insert({
                composer_id: primary_id,
                url: link.url,
                is_primary: link.is_primary,
                display_order: link.display_order,
              });
          }
        }
      }

      // 4. Delete the duplicate composer
      await supabase
        .from("composer")
        .delete()
        .eq("id", duplicate_id);
    } else {
      // Merge work: move all related data from duplicate to primary
      // 1. Merge work_source
      const { data: dupSources } = await supabase
        .from("work_source")
        .select("*")
        .eq("work_id", duplicate_id);

      if (dupSources) {
        for (const source of dupSources) {
          // Check if already exists
          const { data: existing } = await supabase
            .from("work_source")
            .select("id")
            .eq("work_id", primary_id)
            .eq("url", source.url)
            .single();
          
          if (!existing) {
            await supabase
              .from("work_source")
              .insert({
                work_id: primary_id,
                url: source.url,
                title: source.title,
                display_order: source.display_order,
              });
          }
        }
      }

      // 2. Merge work_recording
      const { data: dupRecordings } = await supabase
        .from("work_recording")
        .select("*")
        .eq("work_id", duplicate_id);

      if (dupRecordings) {
        for (const recording of dupRecordings) {
          // Check if already exists
          const { data: existing } = await supabase
            .from("work_recording")
            .select("id")
            .eq("work_id", primary_id)
            .eq("url", recording.url)
            .single();
          
          if (!existing) {
            await supabase
              .from("work_recording")
              .insert({
                work_id: primary_id,
                url: recording.url,
                provider: recording.provider,
                provider_key: recording.provider_key,
                embed_url: recording.embed_url,
                display_order: recording.display_order,
              });
          }
        }
      }

      // 3. Delete the duplicate work
      await supabase
        .from("work")
        .delete()
        .eq("id", duplicate_id);
    }

    // Resolve the review flag
    await supabase
      .from("review_flag")
      .update({
        status: "resolved",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", flagId);

    // Log revision
    await supabase.from("revision").insert({
      entity_type,
      entity_id: primary_id,
      actor_user_id: user.id,
      action: "update",
      snapshot: { merged_from: duplicate_id },
      diff: { merged: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/admin/review/[id]/merge:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

