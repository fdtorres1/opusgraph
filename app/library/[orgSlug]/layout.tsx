// app/library/[orgSlug]/layout.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgContext } from "@/lib/org";
import { LibrarySidebar } from "@/components/library-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

// Force dynamic rendering so Supabase client has access to cookies at runtime
export const dynamic = "force-dynamic";

export default async function LibraryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const result = await getOrgContext(orgSlug);

  if (!result.ok) {
    if (result.error.status === 401) {
      redirect("/auth/login");
    }
    // 403 or 404 — redirect to home
    redirect("/");
  }

  const { org } = result.data;
  // For personal orgs (type 'other'), the name is already "My Library" from the DB.
  // Just use org.name directly — it works for both personal and ensemble orgs.
  const displayName = org.name;

  return (
    <SidebarProvider>
      <LibrarySidebar org={org} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Link
            href={`/library/${org.slug}`}
            className="text-lg font-semibold hover:underline"
          >
            {displayName}
          </Link>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
