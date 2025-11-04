// app/api/public/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createPublicSupabase } from "@/lib/supabase/public";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "all"; // "all", "composers", "works"

    // Use public client with anon key for unauthenticated access
    const supabase = createPublicSupabase();

    const results: {
      composers: any[];
      works: any[];
    } = {
      composers: [],
      works: [],
    };

    // Search composers
    if (type === "all" || type === "composers") {
      const { data: composers, error: composersError } = await supabase.rpc(
        "public_min_composers",
        { q: query || null }
      );
      if (!composersError && composers) {
        results.composers = composers;
      }
    }

    // Search works
    if (type === "all" || type === "works") {
      const { data: works, error: worksError } = await supabase.rpc(
        "public_min_works",
        { q: query || null, composer_id: null }
      );
      if (!worksError && works) {
        results.works = works;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in public search:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

