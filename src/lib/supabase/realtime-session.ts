import type { SupabaseClient } from "@supabase/supabase-js";

/** Attache le JWT au websocket Realtime (sinon RLS avale tous les événements). */
export async function bindRealtimeAuth(
  supabase: SupabaseClient,
): Promise<() => void> {
  const apply = async (token: string | null | undefined) => {
    if (!token) return;
    const realtime = supabase.realtime as {
      setAuth?: (value: string) => unknown;
    };
    if (typeof realtime.setAuth !== "function") return;
    try {
      await realtime.setAuth(token);
    } catch {
      // Client hors ligne — le polling prend le relais.
    }
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  await apply(session?.access_token);

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    void apply(nextSession?.access_token);
  });

  return () => subscription.unsubscribe();
}
