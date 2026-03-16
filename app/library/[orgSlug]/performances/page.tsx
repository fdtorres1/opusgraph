// app/library/[orgSlug]/performances/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgContext } from "@/lib/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns/format";
import { Calendar, Plus } from "lucide-react";

export default async function PerformancesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const result = await getOrgContext(orgSlug);

  if (!result.ok) {
    if (result.error.status === 401) {
      redirect("/auth/login");
    }
    redirect("/");
  }

  const { org, supabase } = result.data;

  const { data: performances } = await supabase
    .from("performance")
    .select(
      `
      id,
      date,
      event_name,
      venue,
      season,
      performance_work(count)
    `
    )
    .eq("organization_id", org.id)
    .order("date", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Performances</h1>
        <Button asChild>
          <Link href={`/library/${org.slug}/performances/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Log New Performance
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {performances?.map((perf) => {
          const workCount =
            Array.isArray(perf.performance_work) && perf.performance_work[0]
              ? (perf.performance_work[0] as { count: number }).count
              : 0;

          return (
            <Card key={perf.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/library/${org.slug}/performances/${perf.id}`}
                      className="hover:underline"
                    >
                      {perf.event_name || "(Untitled)"}
                    </Link>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(perf.date), "MMM d, yyyy")}
                </div>
                {perf.venue && (
                  <p className="text-sm text-zinc-500">{perf.venue}</p>
                )}
                {perf.season && (
                  <p className="text-sm text-zinc-400">
                    Season: {perf.season}
                  </p>
                )}
                <Badge variant="secondary">
                  {workCount} {workCount === 1 ? "work" : "works"}
                </Badge>
              </CardContent>
            </Card>
          );
        })}

        {(!performances || performances.length === 0) && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            No performances logged yet.{" "}
            <Link
              href={`/library/${org.slug}/performances/new`}
              className="underline"
            >
              Log your first performance
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
