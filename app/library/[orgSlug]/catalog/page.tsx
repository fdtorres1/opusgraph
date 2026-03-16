// app/library/[orgSlug]/catalog/page.tsx
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";
import { CatalogClient } from "./catalog-client";

export default async function CatalogPage({
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

  // Fetch initial entries (first 50, ordered by title)
  const selectFields = `
    *,
    work:reference_work_id (
      work_name,
      instrumentation_text,
      duration_seconds,
      composition_year,
      composer:composer_id ( first_name, last_name ),
      publisher:publisher_id ( name )
    ),
    library_entry_part ( id, part_name, quantity, condition ),
    library_entry_tag ( library_tag ( * ) )
  `;

  const { data: entries, count } = await supabase
    .from("library_entry")
    .select(selectFields, { count: "exact" })
    .eq("organization_id", org.id)
    .order("overrides->title", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .range(0, 49);

  return (
    <CatalogClient
      org={org}
      initialEntries={entries ?? []}
      initialTotal={count ?? 0}
    />
  );
}
