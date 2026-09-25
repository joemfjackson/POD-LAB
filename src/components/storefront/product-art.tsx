import type { SfTheme } from "./types";

/** Typographic garment placeholder used when no artwork/mockup has been uploaded yet. */
export function ProductArt({ title, productType, image, theme, large = false }: { title: string; productType: string; image: string | null; theme: SfTheme; large?: boolean }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
    return <img src={image} alt={title} className="aspect-[4/5] w-full object-cover" />;
  }
  return (
    <div className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden" style={{ background: theme.colors.surface }} role="img" aria-label={`${title} — artwork placeholder`}>
      <div className="absolute inset-x-[18%] top-[14%] bottom-[10%] rounded-t-[28%]" style={{ background: theme.colors.background, opacity: 0.85 }} aria-hidden />
      <p
        className={`relative px-[24%] text-center leading-tight font-semibold tracking-wider uppercase ${large ? "text-lg" : "text-[10px]"}`}
        style={{ color: theme.colors.text, fontFamily: `"${theme.fonts.heading}", sans-serif` }}
        aria-hidden
      >
        {title}
      </p>
      <span className="absolute bottom-2 left-2 rounded px-1.5 py-0.5 text-[9px] tracking-wide uppercase" style={{ background: theme.colors.background, color: theme.colors.muted }}>
        {productType.replace("_", " ")} · mockup pending
      </span>
    </div>
  );
}
