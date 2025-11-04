// app/api/admin/import/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseDuration } from "@/lib/duration";

type ValidationResult = {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  duplicateIds?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { entityType, fieldMapping, rows } = await req.json();

    if (!entityType || !fieldMapping || !rows) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const results: ValidationResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const errors: string[] = [];
      const warnings: string[] = [];
      let duplicateIds: string[] | undefined;

      if (entityType === "composer") {
        // Validate required fields
        const firstName = fieldMapping.first_name ? row[fieldMapping.first_name] : null;
        const lastName = fieldMapping.last_name ? row[fieldMapping.last_name] : null;

        if (!firstName || !lastName) {
          errors.push("First name and last name are required");
        }

        // Validate birth year
        if (fieldMapping.birth_year && row[fieldMapping.birth_year]) {
          const year = parseInt(row[fieldMapping.birth_year], 10);
          if (isNaN(year) || year < 1000 || year > 2100) {
            errors.push(`Invalid birth year: ${row[fieldMapping.birth_year]}`);
          }
        }

        // Validate death year
        if (fieldMapping.death_year && row[fieldMapping.death_year]) {
          const year = parseInt(row[fieldMapping.death_year], 10);
          if (isNaN(year) || year < 1000 || year > 2100) {
            errors.push(`Invalid death year: ${row[fieldMapping.death_year]}`);
          }
        }

        // Check for duplicates
        if (firstName && lastName) {
          const birthYear = fieldMapping.birth_year
            ? parseInt(row[fieldMapping.birth_year], 10)
            : null;
          const { data: dupIds } = await supabase.rpc("find_duplicate_composers", {
            in_first: firstName,
            in_last: lastName,
            in_birth_year: birthYear || null,
          });
          if (dupIds && dupIds.length > 0) {
            duplicateIds = dupIds;
            warnings.push(`Possible duplicate found (${dupIds.length} similar)`);
          }
        }

        // Validate nationality codes
        if (fieldMapping.nationalities && row[fieldMapping.nationalities]) {
          const natCodes = row[fieldMapping.nationalities]
            .split(/[,;]/)
            .map((c: string) => c.trim().toUpperCase())
            .filter((c: string) => c.length === 2);
          // Validate against country table
          const { data: countries } = await supabase
            .from("country")
            .select("iso2")
            .in("iso2", natCodes);
          const validCodes = countries?.map((c) => c.iso2) || [];
          const invalidCodes = natCodes.filter((c: string) => !validCodes.includes(c));
          if (invalidCodes.length > 0) {
            warnings.push(`Invalid country codes: ${invalidCodes.join(", ")}`);
          }
        }
      } else if (entityType === "work") {
        // Validate required fields
        const workName = fieldMapping.work_name ? row[fieldMapping.work_name] : null;
        const composerId = fieldMapping.composer_id ? row[fieldMapping.composer_id] : null;

        if (!workName) {
          errors.push("Work name is required");
        }

        // Validate composition year
        if (fieldMapping.composition_year && row[fieldMapping.composition_year]) {
          const year = parseInt(row[fieldMapping.composition_year], 10);
          if (isNaN(year) || year < 1000 || year > 2100) {
            errors.push(`Invalid composition year: ${row[fieldMapping.composition_year]}`);
          }
        }

        // Validate duration
        if (fieldMapping.duration && row[fieldMapping.duration]) {
          try {
            parseDuration(row[fieldMapping.duration]);
          } catch {
            errors.push(`Invalid duration format: ${row[fieldMapping.duration]}. Use MM:SS or HH:MM:SS`);
          }
        }

        // Validate composer ID
        if (composerId) {
          const { data: composer } = await supabase
            .from("composer")
            .select("id")
            .eq("id", composerId)
            .single();
          if (!composer) {
            errors.push(`Composer ID not found: ${composerId}`);
          }
        }

        // Check for duplicates
        if (workName && composerId) {
          const { data: dupIds } = await supabase.rpc("find_duplicate_works", {
            in_composer_id: composerId,
            in_work_name: workName,
          });
          if (dupIds && dupIds.length > 0) {
            duplicateIds = dupIds;
            warnings.push(`Possible duplicate found (${dupIds.length} similar)`);
          }
        }

        // Validate URLs
        if (fieldMapping.sources && row[fieldMapping.sources]) {
          const urls = row[fieldMapping.sources].split(/[,;]/).map((u: string) => u.trim());
          for (const url of urls) {
            try {
              new URL(url);
            } catch {
              errors.push(`Invalid source URL: ${url}`);
            }
          }
        }

        if (fieldMapping.recordings && row[fieldMapping.recordings]) {
          const urls = row[fieldMapping.recordings].split(/[,;]/).map((u: string) => u.trim());
          for (const url of urls) {
            try {
              new URL(url);
            } catch {
              errors.push(`Invalid recording URL: ${url}`);
            }
          }
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
    console.error("Error validating CSV:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

