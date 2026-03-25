import { NextRequest, NextResponse } from "next/server";

import { ingestAdapterRegistry } from "@/lib/ingest/adapters";
import { runIngestJobBatch } from "@/lib/ingest/jobs";
import { IngestJobIdParams, RunIngestJobBatchBody } from "@/lib/validators/ingest-job";
import {
  jsonIssues,
  processIngestCandidate,
  requireAdminIngestContext,
} from "@/app/api/admin/ingest/_shared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireAdminIngestContext("contributor");
  if (context instanceof NextResponse) {
    return context;
  }

  const parsedParams = IngestJobIdParams.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedParams.error.flatten() },
      { status: 400 },
    );
  }

  let body: unknown = {};
  const rawBody = await req.text();
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const parsedBody = RunIngestJobBatchBody.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const executed = await runIngestJobBatch({
    supabase: context.supabase,
    adapterRegistry: ingestAdapterRegistry,
    jobId: parsedParams.data.id,
    access: {
      actorUserId: context.userId,
      canReadAll: true,
      canManageAll: true,
    },
    processCandidate: processIngestCandidate,
    workerIdentity: parsedBody.data.workerIdentity,
    defaultBatchSize: parsedBody.data.defaultBatchSize,
  });

  if (!executed.ok || !executed.data) {
    return jsonIssues(executed.issues);
  }

  return NextResponse.json({
    job: executed.data.job,
    summary: executed.data.summary,
    itemResults: executed.data.itemResults,
    issues: executed.issues,
  });
}
