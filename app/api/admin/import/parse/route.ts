// app/api/admin/import/parse/route.ts
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const text = await file.text();

    return new Promise<NextResponse>((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve(
              NextResponse.json(
                {
                  error: "CSV parsing errors",
                  errors: results.errors,
                },
                { status: 400 }
              )
            );
            return;
          }

          resolve(
            NextResponse.json({
              headers: results.meta.fields || [],
              rows: results.data as any[],
              rowCount: results.data.length,
            })
          );
        },
        error: (error: Error) => {
          resolve(
            NextResponse.json(
              { error: `CSV parsing failed: ${error.message}` },
              { status: 400 }
            )
          );
        },
      });
    });
  } catch (error) {
    console.error("Error parsing CSV:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

