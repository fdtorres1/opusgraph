// app/api/library/entries/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const VALID_SORT_FIELDS = ["title", "composer_last_name", "created_at"] as const;
const VALID_ORDER = ["asc", "desc"] as const;

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);

  // --- Auth ---
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Parse params ---
  const organizationId = searchParams.get("organization_id");
  if (!organizationId) {
    return NextResponse.json(
      { error: "organization_id is required" },
      { status: 400 }
    );
  }

  const q = searchParams.get("q")?.trim() || null;
  const condition = searchParams.get("condition") || null;
  const tagId = searchParams.get("tag_id") || null;

  const sortParam = searchParams.get("sort") || "title";
  const sort = VALID_SORT_FIELDS.includes(sortParam as (typeof VALID_SORT_FIELDS)[number])
    ? sortParam
    : "title";

  const orderParam = searchParams.get("order") || "asc";
  const order = VALID_ORDER.includes(orderParam as (typeof VALID_ORDER)[number])
    ? orderParam
    : "asc";

  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  // --- Verify org membership ---
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Step 1: If full-text search, get matching entry IDs ---
  let searchEntryIds: string[] | null = null;

  if (q) {
    const { data: searchRows, error: searchError } = await supabase
      .from("library_entry_search")
      .select("library_entry_id")
      .eq("organization_id", organizationId)
      .textSearch("search_vector", q, { type: "plain" });

    if (searchError) {
      return NextResponse.json({ error: searchError.message }, { status: 400 });
    }

    searchEntryIds = (searchRows ?? []).map((r) => r.library_entry_id);

    // No matches — return early
    if (searchEntryIds.length === 0) {
      return NextResponse.json({ entries: [], total: 0 });
    }
  }

  // --- Step 2: If tag_id filter, get matching entry IDs ---
  let tagEntryIds: string[] | null = null;

  if (tagId) {
    const { data: tagRows, error: tagError } = await supabase
      .from("library_entry_tag")
      .select("library_entry_id")
      .eq("library_tag_id", tagId);

    if (tagError) {
      return NextResponse.json({ error: tagError.message }, { status: 400 });
    }

    tagEntryIds = (tagRows ?? []).map((r) => r.library_entry_id);

    if (tagEntryIds.length === 0) {
      return NextResponse.json({ entries: [], total: 0 });
    }
  }

  // --- Step 3: Intersect ID sets ---
  let filteredIds: string[] | null = null;

  if (searchEntryIds !== null && tagEntryIds !== null) {
    const tagSet = new Set(tagEntryIds);
    filteredIds = searchEntryIds.filter((id) => tagSet.has(id));
    if (filteredIds.length === 0) {
      return NextResponse.json({ entries: [], total: 0 });
    }
  } else if (searchEntryIds !== null) {
    filteredIds = searchEntryIds;
  } else if (tagEntryIds !== null) {
    filteredIds = tagEntryIds;
  }

  // --- Step 4: Build the main query ---
  const selectFields = `
    *,
    work:reference_work_id (
      work_name,
      instrumentation_text,
      duration_seconds,
      composition_year,
      composer:composer_id ( first_name, last_name ),
      publisher:publisher_id ( name )
    ),
    library_entry_part ( id, part_name, quantity, condition ),
    library_entry_tag ( library_tag ( * ) )
  `;

  // Count query
  let countQuery = supabase
    .from("library_entry")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  // Data query
  let dataQuery = supabase
    .from("library_entry")
    .select(selectFields)
    .eq("organization_id", organizationId);

  // Apply ID filters (from search and/or tag)
  if (filteredIds !== null) {
    countQuery = countQuery.in("id", filteredIds);
    dataQuery = dataQuery.in("id", filteredIds);
  }

  // Apply condition filter
  if (condition) {
    countQuery = countQuery.eq("condition", condition);
    dataQuery = dataQuery.eq("condition", condition);
  }

  // --- Step 5: Sorting ---
  // For title and composer_last_name, we sort by the overrides JSONB field
  // since the search table denormalizes these values.
  // For created_at, sort on the column directly.
  if (sort === "created_at") {
    dataQuery = dataQuery.order("created_at", { ascending: order === "asc" });
  } else if (sort === "composer_last_name") {
    dataQuery = dataQuery.order("overrides->composer_last_name", {
      ascending: order === "asc",
      nullsFirst: order === "asc",
    });
  } else {
    // Default: title — sort by overrides->title
    dataQuery = dataQuery.order("overrides->title", {
      ascending: order === "asc",
      nullsFirst: order === "asc",
    });
  }

  // Secondary sort for stability
  dataQuery = dataQuery.order("created_at", { ascending: true });

  // --- Step 6: Pagination ---
  dataQuery = dataQuery.range(offset, offset + limit - 1);

  // --- Step 7: Execute both queries ---
  const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

  if (countResult.error) {
    return NextResponse.json({ error: countResult.error.message }, { status: 400 });
  }

  if (dataResult.error) {
    return NextResponse.json({ error: dataResult.error.message }, { status: 400 });
  }

  return NextResponse.json({
    entries: dataResult.data ?? [],
    total: countResult.count ?? 0,
  });
}
