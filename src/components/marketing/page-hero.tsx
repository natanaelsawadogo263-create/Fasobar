export function PageHero({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-[#07110e] py-12 text-white sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {kicker ? (
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            {kicker}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-emerald-50/75">
            {subtitle}
          </p>
        ) : null}
      </div>
    </section>
  );
}
