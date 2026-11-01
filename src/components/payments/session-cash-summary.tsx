import { formatPriceXof } from "@/lib/payments/constants";
import type { CashSessionDetail } from "@/lib/payments/types";

type SessionCashSummaryProps = {
  session: CashSessionDetail;
  /** E-commerce : lignes livraisons et frais livreurs toujours affichées (même à 0). */
  withDeliveries?: boolean;
};

/**
 * Bilan de session, toujours dans le même ordre :
 * ventes → chiffre d'affaires → ce qui n'est pas dans le tiroir → total attendu.
 */
export function SessionCashSummary({ session, withDeliveries = false }: SessionCashSummaryProps) {
  const expected = session.openingCashAmount + session.cashCollected;
  // Paiements hors tiroir autres que les frais livreur (mobile money, carte…).
  const otherPayments = Math.max(
    session.salesTotal - session.deliveryFeesTotal - session.cashCollected,
    0,
  );
  const showDeliveries = withDeliveries || session.deliveries.length > 0;

  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-[13px]">
      <Row
        label={
          <>
            Ventes sur place
            <span className="ml-1 text-slate-400">({session.onSiteSalesCount})</span>
          </>
        }
        value={formatPriceXof(session.onSiteSalesTotal)}
      />
      {showDeliveries ? (
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
          {session.deliveries.length > 0 ? (
            <ul className="mt-1.5 space-y-1 pl-3 text-[12px] text-slate-500">
              {session.deliveries.map((delivery) => (
                <li key={delivery.reference} className="pos-tabular">
                  <span className="font-medium text-slate-600">{delivery.reference}</span>
                  {" · "}
                  {formatPriceXof(delivery.total)}
                  {" · "}
                  <span className="text-amber-700">frais {formatPriceXof(delivery.fee)}</span>
                  {" · "}
                  <span className="text-slate-700">reçu {formatPriceXof(delivery.received)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Row label="Chiffre d’affaires" value={formatPriceXof(session.salesTotal)} strong />
      {showDeliveries ? (
        <Row
          label="− Frais livreurs"
          value={formatPriceXof(session.deliveryFeesTotal)}
          valueClassName="text-amber-700"
        />
      ) : null}
      <Row label="− Mobile money / carte" value={formatPriceXof(otherPayments)} />
      <Row label="Espèces encaissées" value={formatPriceXof(session.cashCollected)} />
      <Row label="+ Fond initial" value={formatPriceXof(session.openingCashAmount)} />
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
        <dt className="font-semibold text-slate-700">Total attendu en caisse</dt>
        <dd className="pos-tabular text-[17px] font-bold text-slate-900">
          {formatPriceXof(expected)}
        </dd>
      </div>
    </dl>
  );
}

function Row({
  label,
  value,
  strong = false,
  valueClassName = "text-slate-800",
}: {
  label: React.ReactNode;
  value: string;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className={strong ? "font-semibold text-slate-700" : "text-slate-500"}>{label}</dt>
      <dd
        className={`pos-tabular ${strong ? "font-bold text-slate-900" : `font-medium ${valueClassName}`}`}
      >
        {value}
      </dd>
    </div>
  );
}
