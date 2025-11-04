"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Globe, ExternalLink } from "lucide-react";
import { PublicHeader } from "@/components/public-header";

type Composer = {
  id: string;
  first_name: string;
  last_name: string;
  birth_year?: number | null;
  death_year?: number | null;
  gender_id?: string | null;
  gender_self_describe?: string | null;
  birth_place?: { id: string; label: string } | null;
  death_place?: { id: string; label: string } | null;
  composer_link?: Array<{ id: string; url: string; is_primary?: boolean; display_order?: number }>;
  composer_nationality?: Array<{ country_iso2: string }>;
};

export function AuthenticatedComposerDetail({ composer }: { composer: Composer }) {
  const links = (composer.composer_link || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  const nationalities = composer.composer_nationality || [];

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
          <h1 className="text-4xl font-bold">
            {composer.first_name} {composer.last_name}
          </h1>
        </div>

      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Biographical Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(composer.birth_year || composer.death_year) && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Calendar className="h-4 w-4" />
                <span>
                  {composer.birth_year || "?"}
                  {composer.death_year !== null && composer.death_year !== undefined && (
                    <> - {composer.death_year}</>
                  )}
                </span>
              </div>
            )}

            {(composer.birth_place || composer.death_place) && (
              <div className="space-y-2">
                {composer.birth_place && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <MapPin className="h-4 w-4" />
                    <span>Born: {composer.birth_place.label}</span>
                  </div>
                )}
                {composer.death_place && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <MapPin className="h-4 w-4" />
                    <span>Died: {composer.death_place.label}</span>
                  </div>
                )}
              </div>
            )}

            {nationalities.length > 0 && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Globe className="h-4 w-4" />
                <span>
                  Nationality: {nationalities[0]?.country_iso2}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Links */}
        {links.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>External Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {links.map((link) => (
                  <div key={link.id} className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-zinc-400" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {link.url}
                    </a>
                    {link.is_primary && (
                      <span className="text-xs text-zinc-500">(Primary)</span>
                    )}
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

