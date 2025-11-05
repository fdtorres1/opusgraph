"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Calendar, Music, Clock, ExternalLink } from "lucide-react";
import { detectRecording } from "@/lib/recording";
import { PublicHeader } from "@/components/public-header";

type Work = {
  id: string;
  work_name: string;
  composer_id: string;
  composition_year?: number | null;
  instrumentation_text?: string | null;
  duration_seconds?: number | null;
  ensemble_id?: string | null;
  ensemble?: { id: string; label: string } | null;
  publisher_id?: string | null;
  publisher?: { id: string; name: string } | null;
  composer?: { id: string; first_name: string; last_name: string } | null;
  work_source?: Array<{ id: string; url: string; title?: string | null; display_order?: number }>;
  work_recording?: Array<{ id: string; url: string; embed_url?: string | null; display_order?: number }>;
};

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AuthenticatedWorkDetail({ work }: { work: Work }) {
  const sources = (work.work_source || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  const recordings = (work.work_recording || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  return (
    <>
      <PublicHeader />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/search">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Link>
          </Button>
          <h1 className="text-4xl font-bold">{work.work_name || "Untitled Work"}</h1>
          {work.composer && (
            <p className="text-xl text-zinc-600 mt-2">
              by{" "}
              <Link href={`/composers/${work.composer.id}`} className="hover:underline">
                {work.composer.first_name} {work.composer.last_name}
              </Link>
            </p>
          )}
        </div>

      <div className="space-y-6">
        {/* Basic Information */}
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

            {work.ensemble && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Music className="h-4 w-4" />
                <span>Ensemble: {work.ensemble.label}</span>
              </div>
            )}

            {work.duration_seconds && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Clock className="h-4 w-4" />
                <span>Duration: {formatDuration(work.duration_seconds)}</span>
              </div>
            )}

            {work.instrumentation_text && (
              <div className="pt-2">
                <p className="text-sm font-medium text-zinc-700 mb-1">Instrumentation:</p>
                <p className="text-zinc-600">{work.instrumentation_text}</p>
              </div>
            )}

            {work.publisher && (
              <div className="pt-2">
                <p className="text-sm font-medium text-zinc-700 mb-1">Publisher:</p>
                <p className="text-zinc-600">{work.publisher.name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recordings */}
        {recordings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recordings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recordings.map((recording) => {
                const embedUrl = recording.embed_url || (() => {
                  const info = detectRecording(recording.url);
                  return info?.embedUrl || "";
                })();

                return (
                  <div key={recording.id} className="space-y-2">
                    {embedUrl ? (
                      <div className="w-full">
                        {embedUrl.includes("youtube.com") && (
                          <iframe
                            className="w-full aspect-video rounded"
                            src={embedUrl}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                          />
                        )}
                        {embedUrl.includes("spotify.com") && (
                          <iframe
                            className="w-full h-20 rounded"
                            src={embedUrl}
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          />
                        )}
                        {embedUrl.includes("music.apple.com") && (
                          <iframe
                            className="w-full h-80 rounded"
                            src={embedUrl}
                            allow="autoplay *; encrypted-media *;"
                          />
                        )}
                        {embedUrl.includes("soundcloud.com") && (
                          <iframe
                            className="w-full h-20 rounded"
                            src={embedUrl}
                          />
                        )}
                      </div>
                    ) : (
                      <a
                        href={recording.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {recording.url}
                      </a>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sources.map((source) => (
                  <div key={source.id} className="flex items-center gap-2">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {source.title || source.url}
                    </a>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-zinc-600 transition-colors"
                      aria-label="Open link in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </>
  );
}

