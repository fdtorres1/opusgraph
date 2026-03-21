// app/library/[orgSlug]/catalog/[id]/page.tsx
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";
import LibraryEntryEditor from "./entry-editor";
import EntryComments from "./entry-comments";

export default async function LibraryEntryPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id: paramId } = await params;
  const isNew = paramId === "new";
  const result = await getOrgContext(orgSlug);

  if (!result.ok) {
    if (result.error.status === 401) {
      redirect("/auth/login");
    }
    redirect("/");
  }

  const { org, membership, supabase } = result.data;

  if (isNew && !["owner", "manager"].includes(membership.role)) {
    redirect(`/library/${org.slug}/catalog`);
  }

  let initial: any = null;

  if (!isNew) {
    const { data } = await supabase
      .from("library_entry")
      .select(
        `
        *,
        work:reference_work_id (
          work_name,
          instrumentation_text,
          duration_seconds,
          composition_year,
          composer:composer_id ( first_name, last_name ),
          publisher:publisher_id ( name )
        ),
        library_entry_part ( * ),
        library_entry_tag ( library_tag ( * ) )
      `
      )
      .eq("id", paramId)
      .order("part_name", {
        referencedTable: "library_entry_part",
        ascending: true,
      })
      .single();

    initial = data ?? null;
  }

  return (
    <>
      <LibraryEntryEditor
        initial={initial}
        isNew={isNew}
        org={{ id: org.id, slug: org.slug, name: org.name }}
      />
      {!isNew && initial && <EntryComments entryId={initial.id} />}
    </>
  );
}
