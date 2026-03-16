// app/library/[orgSlug]/settings/members/page.tsx
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org";
import { MembersClient } from "./members-client";

export default async function MembersPage({
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

  const { org, membership, user } = result.data;

  return (
    <div>
      <MembersClient
        org={org}
        currentUserRole={membership.role}
        currentUserId={user.id}
      />
    </div>
  );
}
