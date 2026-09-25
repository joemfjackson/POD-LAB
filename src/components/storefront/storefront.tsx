import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ProductArt } from "./product-art";
import type { SfCollection, SfPage, SfProduct, SfRoute, SfStore } from "./types";
import { routeFromHref } from "./types";

type Href = (r: SfRoute) => string;

const money = (v: number) => `$${v.toFixed(2)}`;

function ProductCard({ p, store, href }: { p: SfProduct; store: SfStore; href: Href }) {
  return (
    <Link href={href({ kind: "product", slug: p.slug })} className="group block">
      <div className="overflow-hidden rounded-md transition-opacity group-hover:opacity-90">
        <ProductArt title={p.design_title ?? p.title} productType={p.product_type} image={p.image} theme={store.theme} />
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="text-sm leading-snug">{p.title}</p>
        <p className="shrink-0 text-sm tabular">
          {money(p.price)}
          {p.compare_at_price ? (
            <span className="ml-1 text-xs line-through" style={{ color: store.theme.colors.muted }}>
              {money(p.compare_at_price)}
            </span>
          ) : null}
        </p>
      </div>
      {p.badges.length ? (
        <p className="mt-1 text-[10px] tracking-wide uppercase" style={{ color: store.theme.colors.accent }}>
          {p.badges.join(" · ")}
        </p>
      ) : null}
    </Link>
  );
}

function Grid({ products, store, href }: { products: SfProduct[]; store: SfStore; href: Href }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 @3xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} store={store} href={href} />
      ))}
    </div>
  );
}

function Section({ s, store, products, collections, href }: { s: SfPage["sections"][number]; store: SfStore; products: SfProduct[]; collections: SfCollection[]; href: Href }) {
  const muted = { color: store.theme.colors.muted };
  const heading: CSSProperties = { fontFamily: `"${store.theme.fonts.heading}", sans-serif` };
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
  switch (s.type) {
    case "hero":
      return (
        <section className="px-5 py-16 @3xl:px-12 @3xl:py-28" style={{ background: store.theme.colors.surface }}>
          {str("eyebrow") ? <p className="mb-3 text-xs tracking-[0.2em] uppercase" style={{ color: store.theme.colors.accent }}>{str("eyebrow")}</p> : null}
          <h2 className="max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight @3xl:text-6xl" style={heading}>
            {str("headline")}
          </h2>
          <p className="mt-4 max-w-xl text-base" style={muted}>
            {str("subheadline")}
          </p>
          <Link href={href({ kind: "collection", slug: "all" })} className="mt-8 inline-block rounded-full px-6 py-3 text-sm font-medium" style={{ background: store.theme.colors.text, color: store.theme.colors.background }}>
            {str("cta_label") || "Shop now"}
          </Link>
        </section>
      );
    case "value_props": {
      const items = (s.items as Array<{ title: string; body: string }>) ?? [];
      return (
        <section className="grid gap-6 border-y px-5 py-10 @3xl:grid-cols-3 @3xl:px-12" style={{ borderColor: store.theme.colors.surface }}>
          {items.map((i) => (
            <div key={i.title}>
              <p className="text-sm font-semibold">{i.title}</p>
              <p className="mt-1 text-sm" style={muted}>
                {i.body}
              </p>
            </div>
          ))}
        </section>
      );
    }
    case "featured_collections": {
      const slugs = (s.collection_slugs as string[]) ?? [];
      const cols = slugs.map((slug) => collections.find((c) => c.slug === slug)).filter((c): c is SfCollection => Boolean(c));
      if (!cols.length) return null;
      return (
        <section className="px-5 py-12 @3xl:px-12">
          <h2 className="mb-6 text-2xl font-semibold" style={heading}>
            {str("title")}
          </h2>
          <div className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-4">
            {cols.map((c) => (
              <Link key={c.slug} href={href({ kind: "collection", slug: c.slug })} className="block rounded-md p-5 transition-opacity hover:opacity-90" style={{ background: store.theme.colors.surface }}>
                <p className="text-lg font-semibold" style={heading}>
                  {c.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs" style={muted}>
                  {c.description}
                </p>
                <p className="mt-6 text-xs tracking-wide uppercase" style={{ color: store.theme.colors.accent }}>
                  Shop →
                </p>
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case "product_grid": {
      const slugs = (s.product_slugs as string[]) ?? [];
      const items = slugs.map((slug) => products.find((p) => p.slug === slug)).filter((p): p is SfProduct => Boolean(p));
      return (
        <section className="px-5 py-12 @3xl:px-12">
          <h2 className="mb-6 text-2xl font-semibold" style={heading}>
            {str("title")}
          </h2>
          <Grid products={items} store={store} href={href} />
        </section>
      );
    }
    case "story":
      return (
        <section className="px-5 py-16 @3xl:px-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold" style={heading}>
              {str("headline")}
            </h2>
            <p className="mt-4 text-base leading-relaxed whitespace-pre-line" style={muted}>
              {str("body")}
            </p>
          </div>
        </section>
      );
    case "email_capture":
      return (
        <section className="px-5 py-14 text-center @3xl:px-12" style={{ background: store.theme.colors.surface }}>
          <h2 className="text-2xl font-semibold" style={heading}>
            {str("headline")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm" style={muted}>
            {str("body")}
          </p>
          {str("incentive") ? <p className="mt-1 text-xs" style={{ color: store.theme.colors.accent }}>{str("incentive")}</p> : null}
          <form className="mx-auto mt-5 flex max-w-sm gap-2" aria-label="Email sign-up (preview)">
            <label className="sr-only" htmlFor="sf-email">
              Email
            </label>
            <input id="sf-email" type="email" disabled placeholder="you@email.com" className="h-10 flex-1 rounded-full border bg-transparent px-4 text-sm" style={{ borderColor: store.theme.colors.muted }} />
            <button type="button" disabled className="h-10 rounded-full px-5 text-sm font-medium" style={{ background: store.theme.colors.text, color: store.theme.colors.background }} title="Preview only">
              Join
            </button>
          </form>
        </section>
      );
    case "faq": {
      const items = (s.items as Array<{ question: string; answer: string }>) ?? [];
      return (
        <section className="px-5 py-12 @3xl:px-12">
          <h2 className="mb-4 text-2xl font-semibold" style={heading}>
            {str("title") || "FAQ"}
          </h2>
          <div className="max-w-3xl divide-y" style={{ borderColor: store.theme.colors.surface }}>
            {items.map((i) => (
              <details key={i.question} className="py-3" style={{ borderColor: store.theme.colors.surface }}>
                <summary className="cursor-pointer text-sm font-medium">{i.question}</summary>
                <p className="mt-2 text-sm" style={muted}>
                  {i.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      );
    }
    case "rich_text":
      return (
        <section className="px-5 py-12 @3xl:px-12">
          {str("title") ? (
            <h2 className="mb-4 text-3xl font-semibold" style={heading}>
              {str("title")}
            </h2>
          ) : null}
          <p className="max-w-2xl text-base leading-relaxed whitespace-pre-line" style={muted}>
            {str("body")}
          </p>
        </section>
      );
    case "contact":
      return (
        <section className="px-5 py-12 @3xl:px-12">
          <h2 className="mb-2 text-3xl font-semibold" style={heading}>
            Contact
          </h2>
          <p className="max-w-xl text-base" style={muted}>
            {str("intro")}
          </p>
          <p className="mt-2 text-sm">{str("response_time")}</p>
          <p className="mt-4 text-xs" style={muted}>
            Contact form and support email are configured at launch.
          </p>
        </section>
      );
    case "size_guide": {
      const rows = (s.rows as Array<{ product: string; product_type: string; sizes: string[] }>) ?? [];
      return (
        <section className="px-5 py-12 @3xl:px-12">
          <h2 className="mb-2 text-3xl font-semibold" style={heading}>
            Size guide
          </h2>
          <p className="max-w-xl text-sm" style={muted}>
            {str("intro")}
          </p>
          <table className="mt-6 w-full max-w-3xl text-left text-sm">
            <thead>
              <tr style={muted}>
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium">Available sizes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product} className="border-t" style={{ borderColor: store.theme.colors.surface }}>
                  <td className="py-2">{r.product}</td>
                  <td className="py-2" style={muted}>
                    {r.sizes.join(" · ") || "One size"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    }
    case "placeholder_notice":
      return (
        <section className="px-5 py-12 @3xl:px-12">
          <div className="max-w-2xl rounded-md border border-dashed p-5 text-sm" style={{ borderColor: store.theme.colors.accent }}>
            <p className="mb-1 font-semibold">Placeholder</p>
            <p style={muted}>{str("body")}</p>
          </div>
        </section>
      );
    default:
      return null;
  }
}

export function Storefront({
  store,
  route,
  pages,
  products,
  collections,
  href,
}: {
  store: SfStore;
  route: SfRoute;
  pages: SfPage[];
  products: SfProduct[];
  collections: SfCollection[];
  href: Href;
}) {
  const t = store.theme;
  const style: CSSProperties = {
    background: t.colors.background,
    color: t.colors.text,
    fontFamily: `"${t.fonts.body}", ui-sans-serif, system-ui, sans-serif`,
  };
  const muted = { color: t.colors.muted };
  const heading: CSSProperties = { fontFamily: `"${t.fonts.heading}", sans-serif` };
  const navHref = (h: string) => href(routeFromHref(h));

  let body: ReactNode;
  if (route.kind === "product") {
    const p = products.find((x) => x.slug === route.slug);
    if (!p) body = <p className="px-5 py-20 text-center">Product not found.</p>;
    else {
      const upsells = p.upsell_ids.map((id) => products.find((x) => x.id === id)).filter((x): x is SfProduct => Boolean(x));
      const cross = p.cross_sell_ids.map((id) => products.find((x) => x.id === id)).filter((x): x is SfProduct => Boolean(x));
      body = (
        <>
          <section className="grid gap-8 px-5 py-10 @3xl:grid-cols-2 @3xl:px-12">
            <div className="overflow-hidden rounded-md">
              <ProductArt title={p.design_title ?? p.title} productType={p.product_type} image={p.image} theme={t} large />
            </div>
            <div>
              {p.badges.length ? <p className="mb-2 text-xs tracking-wide uppercase" style={{ color: t.colors.accent }}>{p.badges.join(" · ")}</p> : null}
              <h2 className="text-3xl font-semibold" style={heading}>
                {p.title}
              </h2>
              <p className="mt-2 text-xl tabular">
                {money(p.price)}
                {p.compare_at_price ? (
                  <span className="ml-2 text-base line-through" style={muted}>
                    {money(p.compare_at_price)}
                  </span>
                ) : null}
              </p>
              {p.colors.length ? (
                <fieldset className="mt-6">
                  <legend className="mb-2 text-xs tracking-wide uppercase" style={muted}>
                    Color
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {p.colors.map((c, i) => (
                      <span key={c} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: i === 0 ? t.colors.text : t.colors.surface }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {p.sizes.length ? (
                <fieldset className="mt-4">
                  <legend className="mb-2 flex w-full justify-between text-xs tracking-wide uppercase" style={muted}>
                    <span>Size</span>
                    <Link href={href({ kind: "page", slug: "size-guide" })} className="normal-case underline">
                      Size guide
                    </Link>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {p.sizes.map((s) => (
                      <span key={s} className="grid h-9 min-w-9 place-items-center rounded border px-2 text-xs" style={{ borderColor: t.colors.surface }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              <button type="button" disabled className="mt-6 h-12 w-full rounded-full text-sm font-semibold" style={{ background: t.colors.text, color: t.colors.background }} title="Checkout is disabled in preview">
                Add to cart
              </button>
              {store.cart_strategy.free_shipping_message ? <p className="mt-2 text-center text-xs" style={muted}>{store.cart_strategy.free_shipping_message}</p> : null}
              <p className="mt-6 text-sm leading-relaxed whitespace-pre-line" style={muted}>
                {p.description}
              </p>
              {p.bullet_points.length ? (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={muted}>
                  {p.bullet_points.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              <details className="mt-6 border-t pt-3 text-sm" style={{ borderColor: t.colors.surface }}>
                <summary className="cursor-pointer">Shipping & returns</summary>
                <p className="mt-2" style={muted}>
                  Printed on demand. See the{" "}
                  <Link href={href({ kind: "page", slug: "shipping" })} className="underline">
                    shipping
                  </Link>{" "}
                  and{" "}
                  <Link href={href({ kind: "page", slug: "returns" })} className="underline">
                    returns
                  </Link>{" "}
                  pages.
                </p>
              </details>
            </div>
          </section>
          {upsells.length ? (
            <section className="px-5 py-10 @3xl:px-12">
              <h3 className="mb-4 text-xl font-semibold" style={heading}>
                {store.cart_strategy.upsell_message ?? "Complete the set"}
              </h3>
              <Grid products={upsells} store={store} href={href} />
            </section>
          ) : null}
          {cross.length ? (
            <section className="px-5 py-10 @3xl:px-12">
              <h3 className="mb-4 text-xl font-semibold" style={heading}>
                You may also like
              </h3>
              <Grid products={cross} store={store} href={href} />
            </section>
          ) : null}
        </>
      );
    }
  } else if (route.kind === "collection") {
    const c = collections.find((x) => x.slug === route.slug);
    const items = route.slug === "all" ? products : products.filter((p) => p.collection_slug === route.slug);
    body = (
      <section className="px-5 py-10 @3xl:px-12">
        <h2 className="text-3xl font-semibold" style={heading}>
          {route.slug === "all" ? "Shop all" : (c?.title ?? "Collection")}
        </h2>
        {c?.description ? (
          <p className="mt-2 max-w-2xl text-sm" style={muted}>
            {c.description}
          </p>
        ) : null}
        {store.cart_strategy.bundle_message ? <p className="mt-2 text-xs" style={{ color: t.colors.accent }}>{store.cart_strategy.bundle_message}</p> : null}
        <div className="mt-8">{items.length ? <Grid products={items} store={store} href={href} /> : <p style={muted}>No products in this collection yet.</p>}</div>
      </section>
    );
  } else {
    const page = pages.find((p) => p.slug === route.slug) ?? pages.find((p) => p.page_type === "home");
    body = page ? page.sections.map((s, i) => <Section key={`${s.type}-${i}`} s={s} store={store} products={products} collections={collections} href={href} />) : <p className="px-5 py-20 text-center">Page not found.</p>;
  }

  const footerPages = pages.filter((p) => p.page_type !== "home");
  return (
    <div className="@container min-h-[70vh]" style={style}>
      {store.announcement ? (
        <p className="px-4 py-2 text-center text-xs" style={{ background: t.colors.accent, color: t.colors.background }}>
          {store.announcement}
        </p>
      ) : null}
      <header className="flex items-center justify-between gap-4 border-b px-5 py-4 @3xl:px-12" style={{ borderColor: t.colors.surface }}>
        <Link href={href({ kind: "page", slug: "home" })} className="text-lg font-bold tracking-tight" style={heading}>
          {t.logo_text}
        </Link>
        <nav aria-label="Store navigation" className="hidden @3xl:block">
          <ul className="flex gap-6 text-sm">
            {store.navigation.map((n) => (
              <li key={n.href + n.label}>
                <Link href={navHref(n.href)} className="hover:opacity-70">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <span className="text-sm" aria-label="Cart, 0 items">
          Cart (0)
        </span>
      </header>
      <nav aria-label="Store navigation (compact)" className="flex gap-4 overflow-x-auto border-b px-5 py-2 text-xs @3xl:hidden" style={{ borderColor: t.colors.surface }}>
        {store.navigation.map((n) => (
          <Link key={n.href + n.label} href={navHref(n.href)} className="whitespace-nowrap">
            {n.label}
          </Link>
        ))}
      </nav>
      <main>{body}</main>
      <footer className="mt-10 border-t px-5 py-10 text-xs @3xl:px-12" style={{ borderColor: t.colors.surface, ...muted }}>
        <div className="grid gap-6 @3xl:grid-cols-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: t.colors.text, ...heading }}>
              {t.logo_text}
            </p>
            <p className="mt-1">Printed on demand.</p>
          </div>
          <ul className="grid grid-cols-2 gap-1">
            {footerPages.map((p) => (
              <li key={p.slug}>
                <Link href={href({ kind: "page", slug: p.slug })} className="hover:opacity-70">
                  {p.title}
                  {p.is_placeholder ? " *" : ""}
                </Link>
              </li>
            ))}
          </ul>
          <p>{store.is_demo ? "DEMO preview — sample content generated without AI. * placeholder page." : "* placeholder page — replace before launch."}</p>
        </div>
      </footer>
    </div>
  );
}
