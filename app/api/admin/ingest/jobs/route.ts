import { NextRequest, NextResponse } from "next/server";

import { createIngestJob } from "@/lib/ingest/jobs";
import { CreateIngestJobBody } from "@/lib/validators/ingest-job";
import {
  ingestAdapterRegistry,
  jsonIssues,
  requireAdminIngestContext,
} from "@/app/api/admin/ingest/_shared";

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
