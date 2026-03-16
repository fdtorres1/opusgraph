// app/library/[orgSlug]/performances/[id]/page.tsx
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";
import PerformanceEditor from "./performance-editor";

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id: paramId } = await params;
  const result = await getOrgContext(orgSlug);

  if (!result.ok) {
    if (result.error.status === 401) {
      redirect("/auth/login");
    }
    redirect("/");
  }

  const { org, supabase } = result.data;
  const isNew = paramId === "new";

  let initial: any = null;

  if (!isNew) {
    const { data } = await supabase
      .from("performance")
      .select(
        `
        *,
        performance_work (
          *,
          library_entry:library_entry_id (
            id,
            overrides,
            reference_work_id,
            work:reference_work_id (
              work_name,
              composer:composer_id ( first_name, last_name )
            )
          )
        )
      `
      )
      .eq("id", paramId)
      .order("program_order", {
        referencedTable: "performance_work",
        ascending: true,
      })
      .single();

    initial = data ?? null;
  }

  return (
    <PerformanceEditor
      initial={initial}
      isNew={isNew}
      org={{ id: org.id, slug: org.slug, name: org.name }}
    />
  );
}
