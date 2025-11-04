// app/admin/composers/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ComposersPage() {
  const supabase = await createServerSupabase();
  
  const { data: composers } = await supabase
    .from("composer")
    .select("id, first_name, last_name, status, created_at")
    .order("last_name")
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Composers</h1>
        <Button asChild>
          <Link href="/admin/composers/new">Create New Composer</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {composers?.map((composer) => {
          const firstName = composer.first_name?.trim() || "";
          const lastName = composer.last_name?.trim() || "";
          const displayName = firstName || lastName 
            ? `${firstName} ${lastName}`.trim()
            : "(Untitled Draft)";
          
          return (
            <Card key={composer.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/admin/composers/${composer.id}`}
                      className="hover:underline"
                    >
                      {displayName}
                    </Link>
                  </CardTitle>
                  <Badge variant={composer.status === "published" ? "default" : "secondary"}>
                    {composer.status}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          );
        })}

        {(!composers || composers.length === 0) && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            No composers yet. <Link href="/admin/composers/new" className="underline">Create your first composer</Link>
          </div>
        )}
      </div>
    </div>
  );
}

