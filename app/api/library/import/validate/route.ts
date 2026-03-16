// app/api/library/import/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type ValidationResult = {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  duplicateIds?: string[];
};

const VALID_CONDITIONS = ["excellent", "good", "fair", "poor", "missing"];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organization_id, fieldMapping, rows } = await req.json();

    if (!organization_id || !fieldMapping || !rows) {
      return NextResponse.json(
        { error: "Missing required fields: organization_id, fieldMapping, rows" },
        { status: 400 }
      );
    }

    // Verify user is manager or owner for this org
    const { data: membership } = await supabase
      .from("org_member")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["owner", "manager"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Insufficient role for this action" },
        { status: 403 }
      );
    }

    // Fetch existing library entries for duplicate detection
    const { data: existing } = await supabase
      .from("library_entry")
      .select("id, overrides")
      .eq("organization_id", organization_id);

    const existingEntries = (existing ?? []).map((e) => ({
      id: e.id as string,
      title: ((e.overrides as Record<string, unknown>)?.title as string ?? "").toLowerCase(),
      composerFirst: ((e.overrides as Record<string, unknown>)?.composer_first_name as string ?? "").toLowerCase(),
      composerLast: ((e.overrides as Record<string, unknown>)?.composer_last_name as string ?? "").toLowerCase(),
    }));

    const results: ValidationResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const errors: string[] = [];
      const warnings: string[] = [];
      let duplicateIds: string[] | undefined;

      // Extract mapped values
      const title = fieldMapping.title
        ? (row[fieldMapping.title]?.toString().trim() ?? "")
        : "";
      const composerFirst = fieldMapping.composer_first_name
        ? (row[fieldMapping.composer_first_name]?.toString().trim() ?? "")
        : "";
      const composerLast = fieldMapping.composer_last_name
        ? (row[fieldMapping.composer_last_name]?.toString().trim() ?? "")
        : "";
      const copiesOwned = fieldMapping.copies_owned
        ? row[fieldMapping.copies_owned]
        : undefined;
      const condition = fieldMapping.condition
        ? (row[fieldMapping.condition]?.toString().trim().toLowerCase() ?? "")
        : "";

      // Validate required fields
      if (!title) {
        errors.push("Title is required");
      }

      // Validate copies_owned
      if (copiesOwned !== undefined && copiesOwned !== null && copiesOwned !== "") {
        const parsed = parseInt(String(copiesOwned), 10);
        if (isNaN(parsed) || parsed < 0) {
          errors.push(
            `Invalid copies_owned: "${copiesOwned}". Must be a non-negative integer`
          );
        }
      }

      // Validate condition
      if (condition && !VALID_CONDITIONS.includes(condition)) {
        errors.push(
          `Invalid condition: "${condition}". Must be one of: ${VALID_CONDITIONS.join(", ")}`
        );
      }

      // Check for duplicates within the org
      if (title) {
        const titleLower = title.toLowerCase();
        const composerFirstLower = composerFirst.toLowerCase();
        const composerLastLower = composerLast.toLowerCase();

        const dupes = existingEntries.filter((e) => {
          // Exact or substring match on title
          const titleMatch =
            e.title === titleLower || e.title.includes(titleLower) || titleLower.includes(e.title);
          if (!titleMatch) return false;

          // If composer info is provided, also check composer match
          if (composerFirstLower || composerLastLower) {
            const composerMatch =
              (composerFirstLower && e.composerFirst.includes(composerFirstLower)) ||
              (composerLastLower && e.composerLast.includes(composerLastLower));
            return composerMatch;
          }

          // Title match alone is sufficient if no composer provided
          return true;
        });

        if (dupes.length > 0) {
          duplicateIds = dupes.map((d) => d.id);
          warnings.push(
            `Possible duplicate: '${title}' already exists (${dupes.length} match${dupes.length > 1 ? "es" : ""})`
          );
        }
      }

      results.push({
        rowIndex: i,
        isValid: errors.length === 0,
        errors,
        warnings,
        duplicateIds,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error validating library CSV:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
