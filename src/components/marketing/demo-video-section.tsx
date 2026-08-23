export function DemoVideoSection() {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Démo
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Découvrez FasoBar en vidéo
          </h2>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-[#07110e] shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)]">
          <video
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
          >
            <source src="/videos/decouverte-fasobar.mp4" type="video/mp4" />
            Votre navigateur ne prend pas en charge la lecture vidéo.
          </video>
        </div>
      </div>
    </section>
  );
}
