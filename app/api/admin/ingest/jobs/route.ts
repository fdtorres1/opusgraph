import { NextRequest, NextResponse } from "next/server";

import type { IngestIssue } from "@/lib/ingest/domain";
import { ingestAdapterRegistry } from "@/lib/ingest/adapters";
import { createIngestJob } from "@/lib/ingest/jobs";
import { CreateIngestJobBody } from "@/lib/validators/ingest-job";
import {
  jsonIssues,
  requireAdminIngestContext,
} from "@/app/api/admin/ingest/_shared";

function issue(
  code: string,
  message: string,
  metadata?: Record<string, string>,
): IngestIssue {
  return {
    code,
    message,
    severity: "error",
    ...(metadata ? { metadata } : {}),
  };
}

export async function POST(req: NextRequest) {
  const context = await requireAdminIngestContext("contributor");
  if (context instanceof NextResponse) {
    return context;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateIngestJobBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.source === "imslp" && parsed.data.entityKind === "work") {
    return jsonIssues([
      issue(
        "imslp_work_jobs_not_supported",
        "The first IMSLP adapter slice only supports composer ingestion jobs.",
        {
          source: parsed.data.source,
          entityKind: parsed.data.entityKind,
        },
      ),
    ]);
  }

  const created = await createIngestJob({
    supabase: context.supabase,
    adapterRegistry: ingestAdapterRegistry,
    input: {
      ...parsed.data,
      createdBy: context.userId,
    },
  });

  if (!created.ok || !created.data) {
    return jsonIssues(created.issues);
  }

  return NextResponse.json({ job: created.data }, { status: 201 });
}
