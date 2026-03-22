import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getRequestedRedirectPath } from "@/lib/auth-redirect";
import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";
import { createServerSupabase } from "@/lib/supabase/server";

const SUPPORTED_EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const requestedRedirect = getRequestedRedirectPath(searchParams, origin);

  if (tokenHash && type && SUPPORTED_EMAIL_OTP_TYPES.has(type as EmailOtpType)) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const destination = await getPostAuthRedirectPath(supabase, user.id, requestedRedirect);
        return NextResponse.redirect(new URL(destination, origin));
      }
    }
  }

  const loginUrl = new URL("/auth/login", origin);
  loginUrl.searchParams.set("error", "auth_callback_error");
  if (requestedRedirect) {
    loginUrl.searchParams.set("redirect", requestedRedirect);
  }
  return NextResponse.redirect(loginUrl);
}
