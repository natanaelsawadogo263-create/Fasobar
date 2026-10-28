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

  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-[13px]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <dt className="font-semibold text-slate-700">Chiffre d’affaires de la session</dt>
        <dd className="pos-tabular font-bold text-slate-900">
          {formatPriceXof(session.salesTotal)}
        </dd>
      </div>

      {session.deliveryFeesTotal > 0 ? (
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Frais de livraison (gardés par les livreurs)</dt>
            <dd className="pos-tabular font-semibold text-amber-700">
              − {formatPriceXof(session.deliveryFeesTotal)}
            </dd>
          </div>
          <ul className="mt-1.5 space-y-0.5 pl-3 text-[12px] text-slate-500">
            {session.deliveryFees.map((fee) => (
              <li key={fee.reference} className="flex items-center justify-between">
                <span>{fee.reference}</span>
                <span className="pos-tabular">{formatPriceXof(fee.amount)}</span>
              </li>
            ))}
          </ul>
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
