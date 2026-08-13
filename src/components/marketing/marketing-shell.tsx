import type { ReactNode } from "react";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { WhatsAppContact } from "@/components/marketing/whatsapp-contact";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-dvh bg-[#f4f6f4] text-slate-900">
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto">
        <MarketingHeader />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-end p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
        <div className="pointer-events-auto">
          <WhatsAppContact variant="float" />
        </div>
      </div>
    </div>
  );
}
