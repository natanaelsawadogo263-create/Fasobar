import { NextResponse } from "next/server";

import { resolvePostLoginRedirect } from "@/lib/auth/post-login";
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
        const path = await resolvePostLoginRedirect(user.id);
        return NextResponse.redirect(`${origin}${path}`);
      }

      return NextResponse.redirect(`${origin}${nextPath ?? "/application"}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
