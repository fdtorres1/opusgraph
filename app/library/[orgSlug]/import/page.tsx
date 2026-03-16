// app/library/[orgSlug]/import/page.tsx
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";
import { LibraryCSVImport } from "./csv-import";

export default async function ImportPage({
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

  const { org } = result.data;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">CSV Import</h1>
        <p className="text-zinc-600 mt-2">
          Import library entries from a CSV file. The system will validate data
          and detect duplicates.
        </p>
      </div>
      <LibraryCSVImport org={org} />
    </div>
  );
}
