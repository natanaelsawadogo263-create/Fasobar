import "server-only";

import { revalidatePath } from "next/cache";

import {
  OPS_BAR_SESSION_PATHS,
  OPS_CASH_SESSION_PATHS,
  OPS_CATALOG_PATHS,
  OPS_ORDER_PATHS,
  OPS_PAYMENT_PATHS,
  OPS_STOCK_PATHS,
} from "@/lib/ops/paths";

function revalidateMany(paths: readonly string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

/** Après création / màj / annulation de commande (caisse → bar / cuisine / admin). */
export function revalidateOrderOps(orderId?: string) {
  revalidateMany(OPS_ORDER_PATHS);
  if (orderId) {
    revalidatePath(`/application/commandes/${orderId}`);
    revalidatePath(`/application/encaissement/${orderId}`);
  }
}

/** Après paiement / reçu (caisse → admin ventes/caisses + bar tickets). */
export function revalidatePaymentOps(orderId?: string, receiptId?: string) {
  revalidateMany(OPS_PAYMENT_PATHS);
  if (orderId) {
    revalidatePath(`/application/commandes/${orderId}`);
    revalidatePath(`/application/encaissement/${orderId}`);
  }
  if (receiptId) {
    revalidatePath(`/application/recus/${receiptId}`);
  }
}

/** Après mouvement stock (admin / bar / cuisine). */
export function revalidateStockOps() {
  revalidateMany(OPS_STOCK_PATHS);
}

/** Après création / modification / activation produit (admin → caisse / bar). */
export function revalidateCatalogOps() {
  revalidateMany(OPS_CATALOG_PATHS);
}

/** Ouverture / fermeture service bar. */
export function revalidateBarSessionOps() {
  revalidateMany(OPS_BAR_SESSION_PATHS);
}

/** Ouverture / fermeture caisse. */
export function revalidateCashSessionOps() {
  revalidateMany(OPS_CASH_SESSION_PATHS);
}
