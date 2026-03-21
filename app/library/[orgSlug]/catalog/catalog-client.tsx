"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveEntryDisplay,
  conditionLabel,
  type LibraryEntryRow,
  type ReferenceWork,
  type ReferenceComposer,
  type ReferencePublisher,
} from "@/lib/library";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryPart = {
  id: string;
  part_name: string | null;
  quantity: number;
  condition: string | null;
};

// Supabase may return joined FK rows as objects or single-element arrays
type MaybeArray<T> = T | T[];

type WorkJoin = {
  work_name: string | null;
  instrumentation_text: string | null;
  duration_seconds: number | null;
  composition_year: number | null;
  composer: MaybeArray<{ first_name: string | null; last_name: string | null }> | null;
  publisher: MaybeArray<{ name: string | null }> | null;
};

type EntryRow = {
  id: string;
  organization_id: string;
  overrides: LibraryEntryRow["overrides"];
  condition: string | null;
  location: string | null;
  copies_owned: number;
  created_at: string;
  work: MaybeArray<WorkJoin> | null;
  library_entry_part: EntryPart[];
  library_entry_tag: unknown[];
};

type OrgInfo = {
  id: string;
  slug: string;
  name: string;
  type: string;
  plan_tier: string;
};

// ---------------------------------------------------------------------------
// Condition badge styling
// ---------------------------------------------------------------------------

function conditionBadgeClassName(condition: string | null | undefined): string {
  switch (condition) {
    case "excellent":
      return "bg-green-600 text-white border-transparent";
    case "good":
      return "bg-green-400 text-white border-transparent";
    case "fair":
      return "bg-yellow-500 text-white border-transparent";
    case "poor":
      return "bg-red-500 text-white border-transparent";
    case "missing":
      return "bg-red-700 text-white border-transparent";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

export function CatalogClient({
  org,
  canManageEntries,
  initialEntries,
  initialTotal,
}: {
  org: OrgInfo;
  canManageEntries: boolean;
  initialEntries: EntryRow[];
  initialTotal: number;
}) {
  const [entries, setEntries] = useState<EntryRow[]>(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [sortBy, setSortBy] = useState("title_asc");
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(PAGE_SIZE);

  // Ref to track whether we're doing an initial/filter fetch vs. load-more
  const isFilterFetch = useRef(false);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Build search params from current state -----
  const buildParams = useCallback(
    (currentOffset: number) => {
      const params = new URLSearchParams({
        organization_id: org.id,
        limit: PAGE_SIZE.toString(),
        offset: currentOffset.toString(),
      });

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (conditionFilter !== "all") {
        params.set("condition", conditionFilter);
      }

      // Map sort selector to API sort + order
      switch (sortBy) {
        case "title_asc":
          params.set("sort", "title");
          params.set("order", "asc");
          break;
        case "composer_asc":
          params.set("sort", "composer_last_name");
          params.set("order", "asc");
          break;
        case "date_desc":
          params.set("sort", "created_at");
          params.set("order", "desc");
          break;
        case "date_asc":
          params.set("sort", "created_at");
          params.set("order", "asc");
          break;
        default:
          params.set("sort", "title");
          params.set("order", "asc");
      }

      return params;
    },
    [org.id, query, conditionFilter, sortBy]
  );

  // ----- Fetch entries from search API -----
  const fetchEntries = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      const params = buildParams(currentOffset);

      try {
        const res = await fetch(
          `/api/library/entries/search?${params.toString()}`
        );
        if (!res.ok) {
          setLoading(false);
          return;
        }

        const json = await res.json();
        const newEntries: EntryRow[] = json.entries ?? [];
        const newTotal: number = json.total ?? 0;

        if (reset) {
          setEntries(newEntries);
          setOffset(PAGE_SIZE);
        } else {
          setEntries((prev) => [...prev, ...newEntries]);
          setOffset((prev) => prev + PAGE_SIZE);
        }

        setTotal(newTotal);
      } finally {
        setLoading(false);
      }
    },
    [offset, buildParams]
  );

  // ----- React to filter / sort changes (debounced for query) -----
  useEffect(() => {
    // On initial mount with no filters, skip — we already have server data
    if (
      query === "" &&
      conditionFilter === "all" &&
      sortBy === "title_asc" &&
      !isFilterFetch.current
    ) {
      return;
    }
    isFilterFetch.current = true;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchEntries(true);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, conditionFilter, sortBy]);

  // ----- Load more -----
  const handleLoadMore = () => {
    if (!loading && entries.length < total) {
      fetchEntries(false);
    }
  };

  // ----- Resolve display data for an entry -----
  const unwrap = <T,>(v: T | T[] | null | undefined): T | null => {
    if (v == null) return null;
    return Array.isArray(v) ? v[0] ?? null : v;
  };

  const resolveDisplay = (entry: EntryRow) => {
    const workRaw = unwrap(entry.work);

    const work: ReferenceWork | null = workRaw
      ? {
          work_name: workRaw.work_name,
          instrumentation_text: workRaw.instrumentation_text,
          duration_seconds: workRaw.duration_seconds,
          composition_year: workRaw.composition_year,
        }
      : null;

    const composer: ReferenceComposer | null = unwrap(workRaw?.composer) ?? null;
    const publisher: ReferencePublisher | null = unwrap(workRaw?.publisher) ?? null;

    return resolveEntryDisplay(
      { overrides: entry.overrides },
      work,
      composer,
      publisher
    );
  };

  // ----- Check if any part has condition='missing' -----
  const hasMissingParts = (entry: EntryRow): boolean => {
    return (entry.library_entry_part ?? []).some(
      (p) => p.condition === "missing"
    );
  };

  const hasMore = entries.length < total;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Catalog</h1>
        {canManageEntries && (
          <Button asChild>
            <Link href={`/library/${org.slug}/catalog/new`}>
              Add New Entry
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input
          placeholder="Search titles, composers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="excellent">Excellent</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
            <SelectItem value="poor">Poor</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title_asc">Title (A-Z)</SelectItem>
            <SelectItem value="composer_asc">Composer (A-Z)</SelectItem>
            <SelectItem value="date_desc">Date Added (newest)</SelectItem>
            <SelectItem value="date_asc">Date Added (oldest)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((entry) => {
          const display = resolveDisplay(entry);
          const missing = hasMissingParts(entry);

          return (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/library/${org.slug}/catalog/${entry.id}`}
                      className="hover:underline"
                    >
                      {display.title || "Untitled"}
                    </Link>
                  </CardTitle>
                  {entry.condition && (
                    <Badge
                      className={conditionBadgeClassName(entry.condition)}
                    >
                      {conditionLabel(entry.condition)}
                    </Badge>
                  )}
                </div>
                {display.composerDisplayName && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {display.composerDisplayName}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {entry.location && (
                    <span>Location: {entry.location}</span>
                  )}
                  {entry.copies_owned > 0 && (
                    <span>
                      {entry.copies_owned}{" "}
                      {entry.copies_owned === 1 ? "copy" : "copies"}
                    </span>
                  )}
                </div>
                {missing && (
                  <Badge
                    variant="destructive"
                    className="mt-2"
                  >
                    Missing Parts
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Loading skeleton cards */}
        {loading &&
          entries.length === 0 &&
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>

      {/* Loading indicator for load-more */}
      {loading && entries.length > 0 && (
        <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          {canManageEntries ? (
            <>
              No entries yet.{" "}
              <Link
                href={`/library/${org.slug}/catalog/new`}
                className="underline"
              >
                Add your first entry.
              </Link>
            </>
          ) : (
            "No entries yet."
          )}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="text-center mt-6">
          <Button onClick={handleLoadMore} variant="outline">
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
