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

    // Run searches in parallel for better performance
    const [composersResult, worksResult] = await Promise.all([
      // Search composers
      (type === "all" || type === "composers")
        ? supabase.rpc("public_min_composers", { q: query || null })
        : Promise.resolve({ data: null, error: null }),
      // Search works
      (type === "all" || type === "works")
        ? supabase.rpc("public_min_works", { q: query || null, composer_id: null })
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (!composersResult.error && composersResult.data) {
      results.composers = composersResult.data;
    }

    if (!worksResult.error && worksResult.data) {
      results.works = worksResult.data;
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

