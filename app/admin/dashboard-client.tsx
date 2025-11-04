"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns/format";

type ActivityEvent = {
  id: string;
  occurred_at: string;
  subject_label: string;
  entity_type: "composer" | "work";
  entity_id: string;
  verb: string;
  source: "revision" | "comment" | "review_flag";
};

export default function AdminDashboardClient({ initialActivity }: { initialActivity: ActivityEvent[] }) {
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
    <div className="space-y-2">
      {initialActivity.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-3 p-2 rounded-lg border bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="text-lg">{getEventIcon(event.source)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getEventColor(event.source) as any} className="text-xs">
                {event.source}
              </Badge>
              <Link
                href={`/admin/${event.entity_type}s/${event.entity_id}`}
                className="font-medium hover:underline text-sm text-zinc-900 dark:text-zinc-50 truncate"
              >
                {event.subject_label || "Unknown"}
              </Link>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
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
  );
}

