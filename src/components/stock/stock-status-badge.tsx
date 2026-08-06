import type { StockStatus } from "@/lib/stock/schemas";
import { STOCK_STATUS_LABELS, STOCK_STATUS_STYLES } from "@/lib/stock/constants";

type StockStatusBadgeProps = {
  status: StockStatus;
};

export function StockStatusBadge({ status }: StockStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STOCK_STATUS_STYLES[status]}`}
    >
      {STOCK_STATUS_LABELS[status]}
    </span>
  );
}
