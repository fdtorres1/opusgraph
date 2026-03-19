// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getRequestedRedirectPath } from "@/lib/auth-redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedRedirect = getRequestedRedirectPath(searchParams);

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check user role to determine redirect
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("user_profile")
          .select("admin_role")
          .eq("user_id", user.id)
          .single();

        const adminRole = profile?.admin_role || "none";
        const hasAdminAccess = ["super_admin", "admin", "contributor"].includes(adminRole);

        if (requestedRedirect?.startsWith("/admin")) {
          // User requested admin page - check if they have access
          if (hasAdminAccess) {
            return NextResponse.redirect(`${origin}${requestedRedirect}`);
          } else {
            // Individual user trying to access admin - redirect to their library
            return NextResponse.redirect(await getLibraryRedirect(supabase, user.id, origin));
          }
        } else if (requestedRedirect) {
          // User requested a specific page (not admin)
          return NextResponse.redirect(`${origin}${requestedRedirect}`);
        } else {
          // No specific redirect - go to appropriate page based on role
          if (hasAdminAccess) {
            return NextResponse.redirect(`${origin}/admin`);
          } else {
            return NextResponse.redirect(await getLibraryRedirect(supabase, user.id, origin));
          }
        }
      }
    }
  }

  // Return the user to an error page with instructions
  const loginUrl = new URL("/auth/login", origin);
  loginUrl.searchParams.set("error", "auth_callback_error");
  if (requestedRedirect) {
    loginUrl.searchParams.set("redirect", requestedRedirect);
  }
  return NextResponse.redirect(loginUrl);
}

/** Look up the user's first org membership and return a redirect URL to their library. */
async function getLibraryRedirect(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  origin: string,
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
      return `${origin}/library/${org.slug}`;
    }
  }

  // Fallback: user has no org memberships (shouldn't happen, personal org is auto-created)
  return `${origin}/search`;
}
