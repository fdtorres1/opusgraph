// app/admin/works/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function WorksPage() {
  const supabase = await createServerSupabase();
  
  const { data: works } = await supabase
    .from("work")
    .select(`
      id, work_name, status, created_at,
      composer:composer_id ( id, first_name, last_name )
    `)
    .order("work_name")
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Works</h1>
        <Button asChild>
          <Link href="/admin/works/new">Create New Work</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {works?.map((work) => {
          const composer = Array.isArray(work.composer) ? work.composer[0] : work.composer;
          return (
            <Card key={work.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/admin/works/${work.id}`}
                      className="hover:underline"
                    >
                      {work.work_name || "Untitled Work"}
                    </Link>
                  </CardTitle>
                  <Badge variant={work.status === "published" ? "default" : "secondary"}>
                    {work.status}
                  </Badge>
                </div>
                {composer && (
                  <p className="text-sm text-zinc-500 mt-1">
                    by {composer.first_name} {composer.last_name}
                  </p>
                )}
              </CardHeader>
            </Card>
          );
        })}

        {(!works || works.length === 0) && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            No works yet. <Link href="/admin/works/new" className="underline">Create your first work</Link>
          </div>
        )}
      </div>
    </div>
  );
}

