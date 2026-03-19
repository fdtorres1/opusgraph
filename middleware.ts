// middleware.ts
// Note: Next.js 16 shows a deprecation warning about middleware file convention.
// This is expected and the middleware.ts file at root is still the correct approach.
// The warning can be safely ignored - functionality is not affected.
// See: https://nextjs.org/docs/app/building-your-application/routing/middleware
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function buildRedirectPath(request: NextRequest): string {
  const path = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function buildLoginUrl(request: NextRequest): URL {
  const url = new URL("/auth/login", request.url);
  url.searchParams.set("redirect", buildRedirectPath(request));
  return url;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect admin routes - require authentication AND admin/contributor role
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(buildLoginUrl(request));
    }

    // Check if user has admin/contributor role
    const { data: profile } = await supabase
      .from("user_profile")
      .select("admin_role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["super_admin", "admin", "contributor"].includes(profile.admin_role || "none")) {
      // User is an Individual (role='none') or has no profile - redirect to search page
      const url = request.nextUrl.clone();
      url.pathname = "/search";
      return NextResponse.redirect(url);
    }
  }

  // Protect library routes - require authentication only
  // Org membership checks happen downstream in getOrgContext()
  if (request.nextUrl.pathname.startsWith("/library")) {
    if (!user) {
      return NextResponse.redirect(buildLoginUrl(request));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
