// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");

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

        // If user has admin/contributor role and requested /admin, allow it
        // Otherwise, redirect based on role
        const adminRole = profile?.admin_role || "none";
        const hasAdminAccess = ["super_admin", "admin", "contributor"].includes(adminRole);

        if (requestedNext?.startsWith("/admin")) {
          // User requested admin page - check if they have access
          if (hasAdminAccess) {
            return NextResponse.redirect(`${origin}${requestedNext}`);
          } else {
            // Individual user trying to access admin - redirect to search
            return NextResponse.redirect(`${origin}/search`);
          }
        } else if (requestedNext) {
          // User requested a specific page (not admin)
          return NextResponse.redirect(`${origin}${requestedNext}`);
        } else {
          // No specific redirect - go to appropriate page based on role
          if (hasAdminAccess) {
            return NextResponse.redirect(`${origin}/admin`);
          } else {
            return NextResponse.redirect(`${origin}/search`);
          }
        }
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
}

