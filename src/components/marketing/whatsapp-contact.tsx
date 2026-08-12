import { FASOBAR_WHATSAPP } from "@/lib/marketing/config";

type WhatsAppContactProps = {
  variant?: "button" | "link" | "nav" | "float";
  className?: string;
};

export function WhatsAppContact({
  variant = "button",
  className = "",
}: WhatsAppContactProps) {
  if (variant === "link") {
    return (
      <a
        href={FASOBAR_WHATSAPP.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`transition hover:text-white ${className}`}
      >
        WhatsApp {FASOBAR_WHATSAPP.display}
      </a>
    );
  }

  if (variant === "nav") {
    return (
      <a
        href={FASOBAR_WHATSAPP.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-emerald-100/90 transition hover:bg-white/5 hover:text-white ${className}`}
      >
        <WhatsAppIcon className="h-3.5 w-3.5" />
        WhatsApp
      </a>
    );
  }

  if (variant === "float") {
    return (
      <a
        href={FASOBAR_WHATSAPP.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Contacter FasoBar sur WhatsApp au ${FASOBAR_WHATSAPP.display}`}
        className={`inline-flex h-14 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(18,140,126,0.85)] transition hover:bg-[#20bd5a] ${className}`}
      >
        <WhatsAppIcon className="h-6 w-6" />
        <span className="pr-1">WhatsApp</span>
      </a>
    );
  }

  return (
    <a
      href={FASOBAR_WHATSAPP.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex h-11 items-center gap-2 rounded-xl bg-[#128C7E] px-5 text-[14px] font-semibold text-white transition hover:bg-[#0f7a6e] ${className}`}
    >
      <WhatsAppIcon className="h-4 w-4" />
      WhatsApp {FASOBAR_WHATSAPP.display}
    </a>
  );
}

function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.4a10.1 10.1 0 0 0 4.65 1.18h.01c5.46 0 9.89-4.4 9.89-9.84C21.94 6.4 17.5 2 12.04 2Zm0 17.97h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.2.83.85-3.12-.2-.32a8.14 8.14 0 0 1-1.25-4.37c0-4.5 3.68-8.16 8.21-8.16 4.37 0 8.2 3.66 8.2 8.16 0 4.5-3.83 8.16-8.12 8.16Zm4.5-6.12c-.25-.12-1.46-.72-1.68-.8-.23-.08-.4-.12-.56.12-.17.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.45-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.12.16 1.73 2.64 4.2 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.17.2-.57.2-1.07.14-1.17-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}
