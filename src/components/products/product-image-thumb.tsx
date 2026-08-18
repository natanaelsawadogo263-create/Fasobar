import Image from "next/image";

type ProductImageThumbProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  placeholderLabel?: string;
};

export function ProductImageThumb({
  src,
  alt = "",
  className = "relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50",
  imageClassName = "object-contain p-0.5",
  sizes,
  placeholderLabel = "Image non ajoutée",
}: ProductImageThumbProps) {
  if (src) {
    return (
      <div className={className}>
        <Image
          src={src}
          alt={alt}
          fill
          className={imageClassName}
          sizes={sizes}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center border border-dashed border-slate-200 bg-slate-50 text-center ${className}`}
      aria-label={placeholderLabel}
    >
      <span className="px-1 text-[7px] font-semibold uppercase leading-tight tracking-wide text-slate-400 sm:text-[8px]">
        {placeholderLabel}
      </span>
    </div>
  );
}
