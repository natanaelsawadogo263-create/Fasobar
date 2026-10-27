import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const ORDER_ID_CHUNK = 100;
const PAGE_SIZE = 1000;

/**
 * Lignes `order_items` d'une liste de commandes, par paquets : une longue
 * période (des milliers de ventes) ne dépasse ni la taille d'URL ni la limite
 * de 1000 lignes par requête, donc les totaux ne sont jamais tronqués.
 */
export async function selectOrderItemsByOrderIds<T>(
  client: SupabaseClient,
  establishmentId: string,
  orderIds: string[],
  columns: string,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const data: T[] = [];

  for (let start = 0; start < orderIds.length; start += ORDER_ID_CHUNK) {
    const chunk = orderIds.slice(start, start + ORDER_ID_CHUNK);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: rows, error } = await client
        .from("order_items")
        .select(columns)
        .eq("establishment_id", establishmentId)
        .in("order_id", chunk)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) return { data, error };
      data.push(...((rows ?? []) as unknown as T[]));
      if (!rows || rows.length < PAGE_SIZE) break;
    }
  }

  return { data, error: null };
}
