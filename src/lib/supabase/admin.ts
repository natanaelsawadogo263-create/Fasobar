import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export class SupabaseAdminConfigError extends Error {
  constructor() {
    super(
      "Configuration serveur Supabase incomplète. Définissez SUPABASE_SECRET_KEY dans .env.local.",
    );
    this.name = "SupabaseAdminConfigError";
  }
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();

  if (!url || !secretKey) {
    throw new SupabaseAdminConfigError();
  }

  return createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isAdminClientConfigured(): boolean {
  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();

  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && secretKey);
}
