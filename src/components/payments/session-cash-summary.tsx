import { formatPriceXof } from "@/lib/payments/constants";
import type { CashSessionDetail } from "@/lib/payments/types";

type SessionCashSummaryProps = {
  session: CashSessionDetail;
};

/**
 * Bilan de session : chiffre d'affaires, frais de livraison gardés par les livreurs
 * (commande par commande), puis ce qui doit réellement se trouver dans le tiroir.
 */
export function SessionCashSummary({ session }: SessionCashSummaryProps) {
  const expected = session.openingCashAmount + session.cashCollected;
  // Paiements hors tiroir autres que les frais livreur (mobile money, carte…).
  const otherPayments = Math.max(
    session.salesTotal - session.deliveryFeesTotal - session.cashCollected,
    0,
  );

  const hasDeliveries = session.deliveries.length > 0;

  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-[13px]">
      {hasDeliveries ? (
        <>
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-slate-500">
              Ventes sur place
              <span className="ml-1 text-slate-400">({session.onSiteSalesCount})</span>
            </dt>
            <dd className="pos-tabular font-medium text-slate-800">
              {formatPriceXof(session.onSiteSalesTotal)}
            </dd>
          </div>
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">
                Ventes livrées
                <span className="ml-1 text-slate-400">({session.deliveries.length})</span>
              </dt>
              <dd className="pos-tabular font-medium text-slate-800">
                {formatPriceXof(session.deliverySalesTotal)}
              </dd>
            </div>
            <ul className="mt-1.5 space-y-1 pl-3 text-[12px] text-slate-500">
              {session.deliveries.map((delivery) => (
                <li key={delivery.reference} className="flex flex-wrap items-center justify-between gap-x-3">
                  <span className="font-medium text-slate-600">{delivery.reference}</span>
                  <span className="pos-tabular">
                    {formatPriceXof(delivery.total)}
                    {delivery.fee > 0 ? (
                      <span className="text-amber-700"> · frais {formatPriceXof(delivery.fee)}</span>
                    ) : null}
                    <span className="text-slate-700"> · reçu {formatPriceXof(delivery.received)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <div className="flex items-center justify-between px-4 py-2.5">
        <dt className="font-semibold text-slate-700">Chiffre d’affaires de la session</dt>
        <dd className="pos-tabular font-bold text-slate-900">
          {formatPriceXof(session.salesTotal)}
        </dd>
      </div>

      {session.deliveryFeesTotal > 0 ? (
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-slate-500">Frais de livraison (gardés par les livreurs)</dt>
          <dd className="pos-tabular font-semibold text-amber-700">
            − {formatPriceXof(session.deliveryFeesTotal)}
          </dd>
        </div>
      ) : null}

      {otherPayments > 0 ? (
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-slate-500">Mobile money / carte (hors tiroir)</dt>
          <dd className="pos-tabular font-medium text-slate-700">
            − {formatPriceXof(otherPayments)}
          </dd>
        </div>
      ) : null}

      <div className="flex items-center justify-between px-4 py-2.5">
        <dt className="text-slate-500">Espèces encaissées</dt>
        <dd className="pos-tabular font-medium text-slate-800">
          {formatPriceXof(session.cashCollected)}
        </dd>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <dt className="text-slate-500">Fond initial</dt>
        <dd className="pos-tabular font-medium text-slate-800">
          + {formatPriceXof(session.openingCashAmount)}
        </dd>
      </div>
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
        <dt className="font-semibold text-slate-700">Total attendu en caisse</dt>
        <dd className="pos-tabular text-[17px] font-bold text-slate-900">
          {formatPriceXof(expected)}
        </dd>
      </div>
    </dl>
  );
}
