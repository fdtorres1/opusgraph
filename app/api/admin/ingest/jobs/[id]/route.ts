import { NextRequest, NextResponse } from "next/server";

import { loadIngestJob } from "@/lib/ingest/jobs";
import { IngestJobIdParams } from "@/lib/validators/ingest-job";
import {
  jsonIssues,
  requireAdminIngestContext,
} from "@/app/api/admin/ingest/_shared";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireAdminIngestContext("contributor");
  if (context instanceof NextResponse) {
    return context;
  }

  const parsed = IngestJobIdParams.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const loaded = await loadIngestJob({
    supabase: context.supabase,
    jobId: parsed.data.id,
    access: {
      actorUserId: context.userId,
      canReadAll: true,
      canManageAll: true,
    },
  });

  if (!loaded.ok || !loaded.data) {
    return jsonIssues(loaded.issues);
  }

  return NextResponse.json({ job: loaded.data });
}
