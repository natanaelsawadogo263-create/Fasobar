import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { sanitizeAuthNextPath } from "@/lib/auth/redirect-origin";
import { createAuthCallbackClient } from "@/lib/supabase/auth-callback";

/**
 * Endpoint for Supabase e-mail templates using token_hash + type
 * (see Authentication → Email Templates).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeAuthNextPath(
    searchParams.get("next"),
    type === "recovery" ? "/nouveau-mot-de-passe" : "/application",
  );

  const destination = type === "recovery" ? "/nouveau-mot-de-passe" : next;
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = destination;
  redirectUrl.search = "";

  if (tokenHash && type) {
    const response = NextResponse.redirect(redirectUrl);
    const supabase = createAuthCallbackClient(request, response);
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      if (type === "recovery") {
        response.cookies.set("fb_pw_recovery", "1", {
          path: "/",
          maxAge: 60 * 30,
          sameSite: "lax",
          httpOnly: false,
        });
      }
      return response;
    }

    console.error("[auth/confirm]", error.code, error.message);
  }

  redirectUrl.pathname = "/";
  redirectUrl.searchParams.set("error", "auth");
  return NextResponse.redirect(redirectUrl);
}
