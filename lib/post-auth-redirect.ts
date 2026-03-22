import { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;

const ADMIN_ROLES = new Set(["super_admin", "admin", "contributor"]);

export async function getLibraryRedirectPath(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<string> {
  const { data: membership } = await supabase
    .from("org_member")
    .select("organization_id, organization:organization_id(slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (membership?.organization && typeof membership.organization === "object") {
    const org = membership.organization as unknown as { slug: string };
    if (org.slug) {
      return `/library/${org.slug}`;
    }
  }

  // Personal org creation should make this rare, but keep a safe fallback.
  return "/search";
}

export async function getPostAuthRedirectPath(
  supabase: ServerSupabaseClient,
  userId: string,
  requestedRedirect: string | null,
): Promise<string> {
  const { data: profile } = await supabase
    .from("user_profile")
    .select("admin_role")
    .eq("user_id", userId)
    .single();

  const adminRole = profile?.admin_role ?? "none";
  const hasAdminAccess = ADMIN_ROLES.has(adminRole);

  if (requestedRedirect?.startsWith("/admin")) {
    return hasAdminAccess
      ? requestedRedirect
      : await getLibraryRedirectPath(supabase, userId);
  }

  if (requestedRedirect) {
    return requestedRedirect;
  }

  return hasAdminAccess ? "/admin" : await getLibraryRedirectPath(supabase, userId);
}
