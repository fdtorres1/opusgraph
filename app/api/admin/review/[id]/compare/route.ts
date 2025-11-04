// app/api/admin/review/[id]/compare/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;

    // Get the review flag
    const { data: flag, error: flagError } = await supabase
      .from("review_flag")
      .select("*")
      .eq("id", id)
      .single();

    if (flagError || !flag) {
      return NextResponse.json(
        { error: "Review flag not found" },
        { status: 404 }
      );
    }

    // Extract duplicate IDs from details
    const duplicateIds = flag.details?.duplicate_ids || [];
    if (duplicateIds.length === 0) {
      return NextResponse.json({
        primary: null,
        duplicates: [],
        entity_type: flag.entity_type,
      });
    }

    // Fetch primary entity
    let primary: any = null;
    if (flag.entity_type === "composer") {
      const { data } = await supabase
        .from("composer")
        .select(`
          id, first_name, last_name, birth_year, death_year,
          gender_id, status,
          composer_nationality(country_iso2),
          composer_link(id, url, is_primary, display_order)
        `)
        .eq("id", flag.entity_id)
        .single();
      primary = data;
    } else {
      const { data } = await supabase
        .from("work")
        .select(`
          id, work_name, composition_year, composer_id, ensemble_id,
          instrumentation_text, duration_seconds, publisher_id, status,
          work_source(id, url, title, display_order),
          work_recording(id, url, provider, embed_url, display_order)
        `)
        .eq("id", flag.entity_id)
        .single();
      primary = data;
    }

    // Fetch duplicate entities
    const duplicates: any[] = [];
    for (const dupId of duplicateIds) {
      if (flag.entity_type === "composer") {
        const { data } = await supabase
          .from("composer")
          .select(`
            id, first_name, last_name, birth_year, death_year,
            gender_id, status,
            composer_nationality(country_iso2),
            composer_link(id, url, is_primary, display_order)
          `)
          .eq("id", dupId)
          .single();
        if (data) duplicates.push(data);
      } else {
        const { data } = await supabase
          .from("work")
          .select(`
            id, work_name, composition_year, composer_id, ensemble_id,
            instrumentation_text, duration_seconds, publisher_id, status,
            work_source(id, url, title, display_order),
            work_recording(id, url, provider, embed_url, display_order)
          `)
          .eq("id", dupId)
          .single();
        if (data) duplicates.push(data);
      }
    }

    return NextResponse.json({
      primary,
      duplicates,
      entity_type: flag.entity_type,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/review/[id]/compare:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

