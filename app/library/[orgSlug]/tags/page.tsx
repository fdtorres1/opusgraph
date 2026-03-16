// app/library/[orgSlug]/tags/page.tsx
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";
import { TagManager } from "./tag-manager";

export default async function TagsPage({
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

  const { org, membership } = result.data;
  const canManage = ["owner", "manager"].includes(membership.role);

  // Members without manage permission get redirected to the catalog
  if (!canManage) {
    redirect(`/library/${org.slug}/catalog`);
  }

  return (
    <div>
      <TagManager org={org} />
    </div>
  );
}
