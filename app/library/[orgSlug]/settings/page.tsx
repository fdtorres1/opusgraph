// app/library/[orgSlug]/settings/page.tsx
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage({
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

  // Only owners can access settings
  if (membership.role !== "owner") {
    redirect(`/library/${org.slug}`);
  }

  return (
    <div>
      <SettingsClient org={org} />
    </div>
  );
}
