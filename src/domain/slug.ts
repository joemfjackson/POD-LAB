export function slugify(input: string, maxLength = 60): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return s.length > 0 ? s : "item";
}

/** Returns a slug not present in `taken`, suffixing -2, -3, ... as needed. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  const root = slugify(base);
  if (!set.has(root)) return root;
  for (let i = 2; i < 10000; i++) {
    const candidate = `${root}-${i}`;
    if (!set.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate a unique slug");
}

/** Normalised key used to detect duplicate research of the same niche. */
export function nicheKey(niche: string): string {
  const stop = new Set(["the", "a", "an", "and", "of", "for", "niche", "market", "pod", "brand"]);
  return niche
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 0 && !stop.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .sort()
    .join(" ");
}
