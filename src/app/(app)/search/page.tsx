import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { getContext } from "@/server/context";
import { searchWorkspace } from "@/server/queries/search";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const ctx = await getContext();
  const term = q.trim().slice(0, 100);
  const results = term.length >= 2 ? await searchWorkspace(ctx, term) : [];
  return (
    <>
      <PageHeader title="Search" description="Brands, opportunities, designs, products, experiments, agents, notes, trends and insights." />
      <form role="search" className="mb-5 flex max-w-xl gap-2">
        <label htmlFor="search-q" className="sr-only">
          Search
        </label>
        <Input id="search-q" name="q" defaultValue={term} placeholder="Search everything…" autoFocus />
        <button type="submit" className={buttonClass("primary")}>
          Search
        </button>
      </form>
      {term.length < 2 ? null : results.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {results.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link href={r.href} className="flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-surface-2">
                  <Badge tone="muted">{r.kind}</Badge>
                  {r.code ? <span className="font-mono text-xs text-accent">{r.code}</span> : null}
                  <span className="text-sm text-ink">{r.title}</span>
                  {r.subtitle ? <span className="ml-auto text-xs text-muted">{r.subtitle}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title={`No results for “${term}”`} />
      )}
    </>
  );
}
