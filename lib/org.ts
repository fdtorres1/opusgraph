// lib/org.ts
// Helper functions for org context resolution and role checking

import { createServerSupabase } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;

export type OrgContext = {
  org: { id: string; slug: string; name: string; type: string; plan_tier: string };
  membership: { id: string; role: string };
  user: { id: string; email?: string };
  supabase: SupabaseClient;
};

export type OrgContextError = {
  error: string;
  status: number;
};

export type OrgContextResult =
  | { ok: true; data: OrgContext }
  | { ok: false; error: OrgContextError };

/**
 * Resolve the org context for the given slug.
 * Returns the org, membership, user, and supabase client on success.
 * Returns a typed error (401/403/404) on failure so callers can build their own response.
 */
export async function getOrgContext(orgSlug: string): Promise<OrgContextResult> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: { error: "Not authenticated", status: 401 } };
  }

  const { data: org, error: orgError } = await supabase
    .from("organization")
    .select("id, slug, name, type, plan_tier")
    .eq("slug", orgSlug)
    .single();

  if (orgError || !org) {
    return { ok: false, error: { error: "Organization not found", status: 404 } };
  }

  const { data: membership, error: memberError } = await supabase
    .from("org_member")
    .select("id, role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (memberError || !membership) {
    return { ok: false, error: { error: "Not a member of this organization", status: 403 } };
  }

  return {
    ok: true,
    data: {
      org: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        type: org.type,
        plan_tier: org.plan_tier,
      },
      membership: {
        id: membership.id,
        role: membership.role,
      },
      user: {
        id: user.id,
        email: user.email,
      },
      supabase,
    },
  };
}

/**
 * Resolve org context and additionally verify the user has one of the allowed roles.
 * Returns 403 if the user's role is not in the allowed list.
 */
export async function requireOrgRole(
  orgSlug: string,
  ...allowedRoles: string[]
): Promise<OrgContextResult> {
  const result = await getOrgContext(orgSlug);

  if (!result.ok) {
    return result;
  }

  if (!allowedRoles.includes(result.data.membership.role)) {
    return {
      ok: false,
      error: { error: "Insufficient role for this action", status: 403 },
    };
  }

  return result;
}
