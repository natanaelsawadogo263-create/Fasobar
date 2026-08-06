import { NextResponse } from "next/server";

import { resolvePostLoginPath } from "@/lib/auth/routes";
import { userHasActiveOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && !nextPath) {
        const hasOrganization = await userHasActiveOrganization(user.id);
        return NextResponse.redirect(
          `${origin}${resolvePostLoginPath(hasOrganization)}`,
        );
      }

      return NextResponse.redirect(`${origin}${nextPath ?? "/application"}`);
    }
  }

  return NextResponse.redirect(`${origin}/connexion?error=auth`);
}
