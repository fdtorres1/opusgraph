// app/works/[id]/public-work-detail.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Lock, ArrowLeft, Calendar, Clock, FileText, Music, ShieldCheck, ExternalLink } from "lucide-react";
import { formatDuration } from "@/lib/duration";
import {
  WORK_TIER_DESCRIPTIONS,
  WORK_TIER_LABELS,
  type ConfidenceLevel,
  type FieldConfidence,
  type PublicWorkTier,
} from "@/lib/public-index/confidence";

type Work = {
  id: string;
  work_name: string;
  composer_id: string;
  composition_year?: number | null;
  instrumentation_text?: string | null;
  duration_seconds?: number | null;
  public_tier?: PublicWorkTier;
  field_confidence?: Partial<FieldConfidence> | null;
  public_notes?: string | null;
};

type PublicEvidence = {
  id: string;
  source?: string | null;
  source_display_name?: string | null;
  public_label?: string | null;
  public_url?: string | null;
  confidence?: ConfidenceLevel | null;
  supports_fields?: string[] | null;
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  confirmed: "Confirmed",
  probable: "Probable",
  inferred: "Inferred",
  conflicting: "Conflicting",
  unknown: "Unknown",
  not_applicable: "Not applicable",
};

function confidenceLabel(value: ConfidenceLevel | undefined): string {
  return value ? CONFIDENCE_LABELS[value] : "Unknown";
}

export function PublicWorkDetail({
  work,
  composerName,
  evidence,
}: {
  work: Work;
  composerName?: string | null;
  evidence: PublicEvidence[];
}) {
  const publicTier = work.public_tier;
  const confidence = work.field_confidence ?? {};
  const duration = formatDuration(work.duration_seconds);
  const hasBasicMetadata =
    Boolean(work.composition_year) ||
    Boolean(duration) ||
    Boolean(work.instrumentation_text?.trim()) ||
    Boolean(work.public_notes?.trim());

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/search">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-bold">{work.work_name || "Untitled Work"}</h1>
          {publicTier && (
            <Badge variant="outline">
              {WORK_TIER_LABELS[publicTier]}
            </Badge>
          )}
        </div>
        {composerName && (
          <p className="text-xl text-zinc-600 mt-2">
            by <Link href={`/composers/${work.composer_id}`} className="hover:underline">{composerName}</Link>
          </p>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Public Index Record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {publicTier && (
              <div>
                <p className="text-sm font-medium text-zinc-700">Visibility tier</p>
                <p className="text-zinc-600">
                  {WORK_TIER_LABELS[publicTier]} - {WORK_TIER_DESCRIPTIONS[publicTier]}
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-zinc-700">Identity</p>
                <p className="text-zinc-600">{confidenceLabel(confidence.identity)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-700">Composer</p>
                <p className="text-zinc-600">{confidenceLabel(confidence.composer)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-700">Orchestral scope</p>
                <p className="text-zinc-600">{confidenceLabel(confidence.orchestral_scope)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasBasicMetadata && (
          <Card>
            <CardHeader>
              <CardTitle>Work Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {work.composition_year && (
                <div className="flex items-center gap-2 text-zinc-600">
                  <Calendar className="h-4 w-4" />
                  <span>Composed: {work.composition_year}</span>
                </div>
              )}

              {duration && (
                <div className="flex items-center gap-2 text-zinc-600">
                  <Clock className="h-4 w-4" />
                  <span>Duration: {duration}</span>
                </div>
              )}

              {work.instrumentation_text && (
                <div className="pt-2">
                  <p className="text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    Instrumentation
                  </p>
                  <p className="text-zinc-600">{work.instrumentation_text}</p>
                </div>
              )}

              {work.public_notes && (
                <div className="pt-2">
                  <p className="text-sm font-medium text-zinc-700 mb-1">Notes</p>
                  <p className="text-zinc-600">{work.public_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Public Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evidence.length > 0 ? (
              <div className="space-y-3">
                {evidence.map((item) => (
                  <div key={item.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {item.public_label || item.source_display_name || item.source || "Source"}
                      </p>
                      {item.confidence && (
                        <Badge variant="outline">{confidenceLabel(item.confidence)}</Badge>
                      )}
                    </div>
                    {item.supports_fields && item.supports_fields.length > 0 && (
                      <p className="mt-1 text-sm text-zinc-600">
                        Supports: {item.supports_fields.join(", ")}
                      </p>
                    )}
                    {item.public_url && (
                      <Button asChild variant="link" className="mt-2 h-auto p-0">
                        <Link href={item.public_url} target="_blank" rel="noreferrer">
                          Open source
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-600">
                Public source links are not shown for this indexed record yet.
              </p>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Full Details Available
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-zinc-600">
            Full work details, instrumentation, recordings, and sources are available to subscribers.
            Sign in or create an account to access complete information.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
