import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Domaine canonique SEO : fasobar.com — www ne doit jamais devenir une
  // deuxième version indexable du site. Redirection permanente, avant toute
  // autre logique. Ne matche QUE l'hôte exact www.fasobar.com : aucun effet
  // en local, en preview Vercel ou sur le domaine apex lui-même.
  if (request.nextUrl.hostname === "www.fasobar.com") {
    const url = request.nextUrl.clone();
    url.hostname = "fasobar.com";
    return NextResponse.redirect(url, 308);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
