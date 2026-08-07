import type { PlatformAccessStatus } from "@/lib/platform/statuses";
import {
  PLATFORM_ACCESS_STATUS_LABELS,
  PLATFORM_ACCESS_STATUS_STYLES,
  isPlatformAccessStatus,
} from "@/lib/platform/statuses";

export function PlatformStatusBadge({ status }: { status: string }) {
  const key: PlatformAccessStatus = isPlatformAccessStatus(status) ? status : "EXPIRED";
  const style = PLATFORM_ACCESS_STATUS_STYLES[key];
  const label = isPlatformAccessStatus(status)
    ? PLATFORM_ACCESS_STATUS_LABELS[status]
    : status;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}
