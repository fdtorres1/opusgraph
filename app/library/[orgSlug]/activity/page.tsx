// app/library/[orgSlug]/activity/page.tsx
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";
import { ActivityClient } from "./activity-client";

export default async function ActivityPage({
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

  return <ActivityClient org={org} />;
}
