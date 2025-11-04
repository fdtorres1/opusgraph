// app/admin/activity/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { format } from "date-fns/format";

type ActivityEvent = {
  id: string;
  occurred_at: string;
  actor_id: string;
  subject_label: string;
  entity_type: "composer" | "work";
  entity_id: string;
  verb: string;
  comment_id: string | null;
  source: "revision" | "comment" | "review_flag";
};

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const fetchEvents = async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    const params = new URLSearchParams({
      limit: "50",
      offset: currentOffset.toString(),
    });
    if (sourceFilter !== "all") params.append("source", sourceFilter);
    if (entityFilter !== "all") params.append("entity_type", entityFilter);

    const res = await fetch(`/api/admin/activity?${params}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }

    const json = await res.json();
    const newEvents = json.events || [];

    if (reset) {
      setEvents(newEvents);
      setOffset(50);
    } else {
      setEvents((prev) => [...prev, ...newEvents]);
      setOffset((prev) => prev + 50);
    }

    setHasMore(newEvents.length === 50);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents(true);
  }, [sourceFilter, entityFilter]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchEvents();
    }
  };

  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.occurred_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, ActivityEvent[]>);

  const getEventIcon = (source: string) => {
    switch (source) {
      case "revision":
        return "📝";
      case "comment":
        return "💬";
      case "review_flag":
        return "🚩";
      default:
        return "•";
    }
  };

  const getEventColor = (source: string) => {
    switch (source) {
      case "revision":
        return "default";
      case "comment":
        return "secondary";
      case "review_flag":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Activity</h1>
        <div className="flex gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="revision">Revisions</SelectItem>
              <SelectItem value="comment">Comments</SelectItem>
              <SelectItem value="review_flag">Review Flags</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="composer">Composers</SelectItem>
              <SelectItem value="work">Works</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedEvents).map(([date, dateEvents]) => (
          <div key={date}>
            <h2 className="text-lg font-semibold mb-3 text-zinc-700 dark:text-zinc-300">{date}</h2>
            <div className="space-y-2">
              {dateEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  <span className="text-xl">{getEventIcon(event.source)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getEventColor(event.source) as any}>
                        {event.source}
                      </Badge>
                      <Link
                        href={`/admin/${event.entity_type}s/${event.entity_id}`}
                        className="font-medium hover:underline text-zinc-900 dark:text-zinc-50"
                      >
                        {event.subject_label || "Unknown"}
                      </Link>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {event.verb}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {format(new Date(event.occurred_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {events.length === 0 && !loading && (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            No activity found
          </div>
        )}

        {loading && (
          <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">
            Loading...
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center">
            <Button onClick={handleLoadMore} variant="outline">
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

