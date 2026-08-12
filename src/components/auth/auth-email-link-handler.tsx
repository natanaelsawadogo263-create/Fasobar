"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/** Completes Auth sessions when Supabase returns tokens in the URL hash. */
export function AuthEmailLinkHandler() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(
      hash.startsWith("#") ? hash.slice(1) : hash,
    );
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    handled.current = true;
    const type = params.get("type");

    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );

      if (error) {
        router.replace("/?error=auth");
        return;
      }

      if (type === "recovery") {
        document.cookie = "fb_pw_recovery=1; path=/; max-age=1800; samesite=lax";
        router.replace("/nouveau-mot-de-passe");
        return;
      }

      router.replace("/application");
      router.refresh();
    })();
  }, [router]);

  return null;
}
