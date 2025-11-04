// app/api/admin/import/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseDuration } from "@/lib/duration";

type ImportResult = {
  rowIndex: number;
  success: boolean;
  entityId?: string;
  error?: string;
  action: "created" | "updated" | "skipped";
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { entityType, fieldMapping, rows, skipDuplicates } = await req.json();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: ImportResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        if (entityType === "composer") {
          const firstName = row[fieldMapping.first_name]?.trim() || "";
          const lastName = row[fieldMapping.last_name]?.trim() || "";

          if (!firstName || !lastName) {
            results.push({
              rowIndex: i,
              success: false,
              error: "First name and last name are required",
              action: "skipped",
            });
            continue;
          }

          // Check for duplicates
          const birthYear = fieldMapping.birth_year
            ? parseInt(row[fieldMapping.birth_year], 10)
            : null;
        const { data: dupIds } = await supabase.rpc("find_duplicate_composers", {
          in_first: firstName,
          in_last: lastName,
          in_birth_year: birthYear || null,
        });

        if (dupIds && dupIds.length > 0) {
          if (skipDuplicates) {
            results.push({
              rowIndex: i,
              success: false,
              error: "Duplicate detected, skipped",
              action: "skipped",
            });
            continue;
          } else {
            // Auto-flag for review
            await supabase.from("review_flag").insert({
              entity_type: "composer",
              entity_id: dupIds[0], // Flag the existing duplicate
              reason: "possible_duplicate",
              details: {
                duplicate_ids: dupIds,
                import_source: "csv_import",
                imported_name: `${firstName} ${lastName}`,
              },
              status: "open",
              created_by: user.id,
            });
          }
        }

          // Prepare composer data
          const composerData: any = {
            first_name: firstName,
            last_name: lastName,
            status: "draft",
          };

          if (fieldMapping.birth_year && row[fieldMapping.birth_year]) {
            const year = parseInt(row[fieldMapping.birth_year], 10);
            if (!isNaN(year) && year >= 1000 && year <= 2100) {
              composerData.birth_year = year;
            }
          }

          if (fieldMapping.death_year && row[fieldMapping.death_year]) {
            const year = parseInt(row[fieldMapping.death_year], 10);
            if (!isNaN(year) && year >= 1000 && year <= 2100) {
              composerData.death_year = year;
            }
          }

          if (fieldMapping.gender_id && row[fieldMapping.gender_id]) {
            composerData.gender_id = row[fieldMapping.gender_id];
          }

          if (fieldMapping.status && row[fieldMapping.status]) {
            composerData.status = row[fieldMapping.status] === "published" ? "published" : "draft";
          }

          // Insert composer
          const { data: composer, error: insertError } = await supabase
            .from("composer")
            .insert(composerData)
            .select()
            .single();

          if (insertError) {
            results.push({
              rowIndex: i,
              success: false,
              error: insertError.message,
              action: "skipped",
            });
            continue;
          }

          // Add nationalities
          if (fieldMapping.nationalities && row[fieldMapping.nationalities] && composer) {
            const natCodes = row[fieldMapping.nationalities]
              .split(/[,;]/)
              .map((c: string) => c.trim().toUpperCase())
              .filter((c: string) => c.length === 2);
            
            if (natCodes.length > 0) {
              await supabase.from("composer_nationality").insert(
                natCodes.map((code: string) => ({
                  composer_id: composer.id,
                  country_iso2: code,
                }))
              );
            }
          }

          // Add links
          if (fieldMapping.links && row[fieldMapping.links] && composer) {
            const urls = row[fieldMapping.links]
              .split(/[,;]/)
              .map((u: string) => u.trim())
              .filter((u: string) => u.startsWith("http"));
            
            if (urls.length > 0) {
              await supabase.from("composer_link").insert(
                urls.map((url: string, idx: number) => ({
                  composer_id: composer.id,
                  url,
                  is_primary: idx === 0,
                  display_order: idx,
                }))
              );
            }
          }

          // Log revision
          await supabase.from("revision").insert({
            entity_type: "composer",
            entity_id: composer.id,
            actor_user_id: user.id,
            action: "create",
            snapshot: composerData,
          });

          results.push({
            rowIndex: i,
            success: true,
            entityId: composer.id,
            action: "created",
          });
        } else if (entityType === "work") {
          const workName = row[fieldMapping.work_name]?.trim() || "";
          const composerId = row[fieldMapping.composer_id]?.trim();

          if (!workName) {
            results.push({
              rowIndex: i,
              success: false,
              error: "Work name is required",
              action: "skipped",
            });
            continue;
          }

          if (!composerId) {
            results.push({
              rowIndex: i,
              success: false,
              error: "Composer ID is required",
              action: "skipped",
            });
            continue;
          }

          // Check for duplicates
          const { data: dupIds } = await supabase.rpc("find_duplicate_works", {
            in_composer_id: composerId,
            in_work_name: workName,
          });

          if (dupIds && dupIds.length > 0) {
            if (skipDuplicates) {
              results.push({
                rowIndex: i,
                success: false,
                error: "Duplicate detected, skipped",
                action: "skipped",
              });
              continue;
            } else {
              // Auto-flag for review
              await supabase.from("review_flag").insert({
                entity_type: "work",
                entity_id: dupIds[0], // Flag the existing duplicate
                reason: "possible_duplicate",
                details: {
                  duplicate_ids: dupIds,
                  import_source: "csv_import",
                  imported_work_name: workName,
                },
                status: "open",
                created_by: user.id,
              });
            }
          }

          // Prepare work data
          const workData: any = {
            work_name: workName,
            composer_id: composerId,
            status: "draft",
          };

          if (fieldMapping.composition_year && row[fieldMapping.composition_year]) {
            const year = parseInt(row[fieldMapping.composition_year], 10);
            if (!isNaN(year) && year >= 1000 && year <= 2100) {
              workData.composition_year = year;
            }
          }

          if (fieldMapping.duration && row[fieldMapping.duration]) {
            try {
              workData.duration_seconds = parseDuration(row[fieldMapping.duration]);
            } catch {
              // Skip invalid duration
            }
          }

          if (fieldMapping.instrumentation_text && row[fieldMapping.instrumentation_text]) {
            workData.instrumentation_text = row[fieldMapping.instrumentation_text].trim();
          }

          if (fieldMapping.publisher_id && row[fieldMapping.publisher_id]) {
            workData.publisher_id = row[fieldMapping.publisher_id];
          }

          if (fieldMapping.status && row[fieldMapping.status]) {
            workData.status = row[fieldMapping.status] === "published" ? "published" : "draft";
          }

          // Insert work
          const { data: work, error: insertError } = await supabase
            .from("work")
            .insert(workData)
            .select()
            .single();

          if (insertError) {
            results.push({
              rowIndex: i,
              success: false,
              error: insertError.message,
              action: "skipped",
            });
            continue;
          }

          // Add sources
          if (fieldMapping.sources && row[fieldMapping.sources] && work) {
            const urls = row[fieldMapping.sources]
              .split(/[,;]/)
              .map((u: string) => u.trim())
              .filter((u: string) => u.startsWith("http"));
            
            if (urls.length > 0) {
              await supabase.from("work_source").insert(
                urls.map((url: string, idx: number) => ({
                  work_id: work.id,
                  url,
                  display_order: idx,
                }))
              );
            }
          }

          // Add recordings
          if (fieldMapping.recordings && row[fieldMapping.recordings] && work) {
            const urls = row[fieldMapping.recordings]
              .split(/[,;]/)
              .map((u: string) => u.trim())
              .filter((u: string) => u.startsWith("http"));
            
            if (urls.length > 0) {
              await supabase.from("work_recording").insert(
                urls.map((url: string, idx: number) => ({
                  work_id: work.id,
                  url,
                  display_order: idx,
                }))
              );
            }
          }

          // Log revision
          await supabase.from("revision").insert({
            entity_type: "work",
            entity_id: work.id,
            actor_user_id: user.id,
            action: "create",
            snapshot: workData,
          });

          results.push({
            rowIndex: i,
            success: true,
            entityId: work.id,
            action: "created",
          });
        }
      } catch (error: any) {
        results.push({
          rowIndex: i,
          success: false,
          error: error.message || "Unknown error",
          action: "skipped",
        });
      }
    }

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        skipped: results.filter((r) => r.action === "skipped").length,
      },
    });
  } catch (error) {
    console.error("Error executing import:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

