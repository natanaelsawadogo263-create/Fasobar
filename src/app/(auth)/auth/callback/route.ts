import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { resolvePostLoginRedirect } from "@/lib/auth/post-login";
import { sanitizeAuthNextPath } from "@/lib/auth/redirect-origin";
import { createAuthCallbackClient } from "@/lib/supabase/auth-callback";

function buildRedirect(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  const [pathname, query = ""] = path.split("?");
  url.pathname = pathname || "/";
  url.search = query ? `?${query}` : "";
  url.hash = "";
  return NextResponse.redirect(url);
}

/**
 * Handles Supabase Auth redirects after e-mail links:
 * - PKCE `?code=` (exchangeCodeForSession)
 * - SSR template `?token_hash=&type=` (verifyOtp)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const requestedNext = sanitizeAuthNextPath(
    searchParams.get("next"),
    type === "recovery" ? "/nouveau-mot-de-passe" : "/application",
  );

  if (tokenHash && type) {
    const destination =
      type === "recovery" ? "/nouveau-mot-de-passe" : requestedNext;
    const response = buildRedirect(request, destination);
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

    console.error("[auth/callback:verifyOtp]", error.code, error.message);
  }

  if (code) {
    const isRecovery =
      type === "recovery" || requestedNext === "/nouveau-mot-de-passe";
    const provisionalPath = isRecovery
      ? "/nouveau-mot-de-passe"
      : requestedNext;
    const response = buildRedirect(request, provisionalPath);
    const supabase = createAuthCallbackClient(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (isRecovery) {
        response.cookies.set("fb_pw_recovery", "1", {
          path: "/",
          maxAge: 60 * 30,
          sameSite: "lax",
          httpOnly: false,
        });
        return response;
      }

      if (searchParams.get("next")) {
        return response;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const path = await resolvePostLoginRedirect(user.id);
        const finalResponse = buildRedirect(request, path);
        response.cookies.getAll().forEach((cookie) => {
          finalResponse.cookies.set(cookie);
        });
        return finalResponse;
      }

      return response;
    }

    console.error("[auth/callback:exchangeCode]", error.code, error.message);
  }

  return buildRedirect(request, "/?error=auth");
}
