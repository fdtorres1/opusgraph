// app/admin/review/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function ReviewPage() {
  const supabase = await createServerSupabase();
  
  const { data: flags } = await supabase
    .from("review_flag")
    .select(`
      id, reason, status, created_at, notes,
      entity_type, entity_id
    `)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Review Queue</h1>
      </div>

      {flags && flags.length > 0 ? (
        <div className="space-y-4">
          {flags.map((flag) => (
            <Card key={flag.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {flag.entity_type === "composer" ? (
                      <Link
                        href={`/admin/composers/${flag.entity_id}`}
                        className="hover:underline"
                      >
                        Composer Review
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/works/${flag.entity_id}`}
                        className="hover:underline"
                      >
                        Work Review
                      </Link>
                    )}
                  </CardTitle>
                  <Badge variant="destructive">Open</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600 mb-2">
                  <strong>Reason:</strong> {flag.reason}
                </p>
                {flag.notes && (
                  <p className="text-sm text-zinc-600">
                    <strong>Notes:</strong> {flag.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg">No items in the review queue.</p>
          <p className="text-sm mt-2">All items have been reviewed.</p>
        </div>
      )}
    </div>
  );
}

