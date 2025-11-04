// app/api/places/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;

    const { data: place, error } = await supabase
      .from("place")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !place) {
      return NextResponse.json(
        { error: "Place not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: place.id,
      description: place.label,
      city: place.city,
      admin_area: place.admin_area,
      country_iso2: place.country_iso2,
      lat: place.lat,
      lon: place.lon,
      provider: place.provider,
    });
  } catch (error) {
    console.error("Error in GET /api/places/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

