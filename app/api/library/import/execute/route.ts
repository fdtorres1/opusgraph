// app/api/library/import/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type ImportResult = {
  rowIndex: number;
  success: boolean;
  entityId?: string;
  error?: string;
  action: "created" | "failed" | "skipped";
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

    const { organization_id, fieldMapping, rows, skipDuplicates } =
      await req.json();

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
      title: (
        (e.overrides as Record<string, unknown>)?.title as string ?? ""
      ).toLowerCase(),
      composerFirst: (
        (e.overrides as Record<string, unknown>)?.composer_first_name as string ?? ""
      ).toLowerCase(),
      composerLast: (
        (e.overrides as Record<string, unknown>)?.composer_last_name as string ?? ""
      ).toLowerCase(),
    }));

    const results: ImportResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
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
        const arranger = fieldMapping.arranger
          ? (row[fieldMapping.arranger]?.toString().trim() ?? "")
          : "";
        const publisher = fieldMapping.publisher
          ? (row[fieldMapping.publisher]?.toString().trim() ?? "")
          : "";
        const instrumentation = fieldMapping.instrumentation
          ? (row[fieldMapping.instrumentation]?.toString().trim() ?? "")
          : "";
        const copiesOwnedRaw = fieldMapping.copies_owned
          ? row[fieldMapping.copies_owned]
          : undefined;
        const location = fieldMapping.location
          ? (row[fieldMapping.location]?.toString().trim() ?? "")
          : "";
        const conditionRaw = fieldMapping.condition
          ? (row[fieldMapping.condition]?.toString().trim().toLowerCase() ?? "")
          : "";
        const notes = fieldMapping.notes
          ? (row[fieldMapping.notes]?.toString().trim() ?? "")
          : "";

        // Validate title (required)
        if (!title) {
          results.push({
            rowIndex: i,
            success: false,
            error: "Title is required",
            action: "failed",
          });
          continue;
        }

        // Check for duplicates
        const titleLower = title.toLowerCase();
        const composerFirstLower = composerFirst.toLowerCase();
        const composerLastLower = composerLast.toLowerCase();

        const dupes = existingEntries.filter((e) => {
          const titleMatch =
            e.title === titleLower ||
            e.title.includes(titleLower) ||
            titleLower.includes(e.title);
          if (!titleMatch) return false;

          if (composerFirstLower || composerLastLower) {
            const composerMatch =
              (composerFirstLower &&
                e.composerFirst.includes(composerFirstLower)) ||
              (composerLastLower &&
                e.composerLast.includes(composerLastLower));
            return composerMatch;
          }

          return true;
        });

        if (dupes.length > 0 && skipDuplicates) {
          results.push({
            rowIndex: i,
            success: true,
            action: "skipped",
          });
          continue;
        }

        // Build overrides JSONB
        const overrides: Record<string, string> = {};
        if (title) overrides.title = title;
        if (composerFirst) overrides.composer_first_name = composerFirst;
        if (composerLast) overrides.composer_last_name = composerLast;
        if (arranger) overrides.arranger = arranger;
        if (publisher) overrides.publisher = publisher;
        if (instrumentation) overrides.instrumentation = instrumentation;

        // Parse copies_owned
        let copiesOwned = 0;
        if (
          copiesOwnedRaw !== undefined &&
          copiesOwnedRaw !== null &&
          copiesOwnedRaw !== ""
        ) {
          const parsed = parseInt(String(copiesOwnedRaw), 10);
          if (!isNaN(parsed) && parsed >= 0) {
            copiesOwned = parsed;
          }
        }

        // Parse condition
        const condition =
          conditionRaw && VALID_CONDITIONS.includes(conditionRaw)
            ? conditionRaw
            : null;

        // Attempt reference work matching
        let referenceWorkId: string | null = null;
        if (title) {
          const composerClause =
            composerFirst || composerLast
              ? `${composerFirst} ${composerLast}`.trim()
              : null;

          const { data: matches } = await supabase
            .from("work")
            .select("id, work_name, composer(first_name, last_name)")
            .eq("status", "published")
            .ilike("work_name", `%${title}%`)
            .limit(5);

          if (matches && matches.length > 0) {
            if (composerClause) {
              // Try to find a match that also matches composer
              const composerMatch = matches.find((m) => {
                const comp = m.composer as unknown as {
                  first_name: string;
                  last_name: string;
                } | null;
                if (!comp) return false;
                const fullName =
                  `${comp.first_name} ${comp.last_name}`.toLowerCase();
                return (
                  fullName.includes(composerFirstLower) ||
                  fullName.includes(composerLastLower)
                );
              });
              referenceWorkId = composerMatch?.id ?? matches[0].id;
            } else {
              referenceWorkId = matches[0].id;
            }
          }
        }

        // Insert library_entry
        const insertData: Record<string, unknown> = {
          organization_id,
          created_by: user.id,
          overrides,
          copies_owned: copiesOwned,
          location: location || null,
          condition,
          notes: notes || null,
          reference_work_id: referenceWorkId,
        };

        const { data: entry, error: insertError } = await supabase
          .from("library_entry")
          .insert(insertData)
          .select("*")
          .single();

        if (insertError) {
          results.push({
            rowIndex: i,
            success: false,
            error: insertError.message,
            action: "failed",
          });
          continue;
        }

        // Log revision
        await supabase.from("revision").insert({
          entity_type: "library_entry",
          entity_id: entry.id,
          actor_user_id: user.id,
          action: "create",
          organization_id,
          snapshot: entry,
        });

        // Add the new entry to the in-memory list so subsequent rows can
        // detect duplicates against entries created within this same batch
        existingEntries.push({
          id: entry.id,
          title: titleLower,
          composerFirst: composerFirstLower,
          composerLast: composerLastLower,
        });

        results.push({
          rowIndex: i,
          success: true,
          entityId: entry.id,
          action: "created",
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          rowIndex: i,
          success: false,
          error: message,
          action: "failed",
        });
      }
    }

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success && r.action === "created")
          .length,
        failed: results.filter((r) => r.action === "failed").length,
        skipped: results.filter((r) => r.action === "skipped").length,
      },
    });
  } catch (error) {
    console.error("Error executing library import:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
