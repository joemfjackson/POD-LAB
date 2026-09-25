import type { Metadata } from "next";
import Link from "next/link";
import { serverEnv } from "@/lib/env";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValue, Notice } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatUsd } from "@/domain/format";
import { roleAtLeast } from "@/domain/permissions";
import { requestGateAction } from "@/server/actions/approvals";
import { publishShopifyAction, setStoreStatusAction } from "@/server/actions/stores";
import { getContext } from "@/server/context";
import { loadStorefront } from "@/server/queries/storefront";

export const metadata: Metadata = { title: "Store" };

const EXPORTS = [
  { adapter: "generic_export", label: "Brand/store package (JSON)", note: "Brand, identity, products, collections, pages, SEO, pricing, assets, campaigns." },
  { adapter: "nextjs", label: "Next.js storefront manifest", note: "Route manifest for a custom Next.js storefront." },
  { adapter: "shopify", label: "Shopify product CSV", note: "Import via Shopify Admin → Products → Import (drafts)." },
  { adapter: "fulfill_engine", label: "Fulfillment mapping (JSON)", note: "Product → provider SKU mapping. Live sync requires provider connection." },
];

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const { raw, pages, products, collections } = await loadStorefront(ctx, id);
  const gate = await ctx.db.from("approval_gates").select("id, status").eq("subject_id", id).eq("gate_type", "store_launch").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const env = serverEnv();
  const shopifyConfigured = Boolean(env.SHOPIFY_STORE_DOMAIN && env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  const canEdit = ctx.role !== "viewer";
  const placeholders = pages.filter((p) => p.is_placeholder);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Stores", href: "/stores" }, { label: raw.code }]}
        eyebrow={
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{raw.code}</span>
            <StatusChip status={raw.status} />
            <Badge tone="muted">v{raw.version}</Badge>
            <DemoBadge show={raw.is_demo} />
          </div>
        }
        title={raw.name}
        description={raw.seo_description}
        actions={
          <>
            <ButtonLink href={`/stores/${id}/preview`} variant="primary">
              Preview storefront
            </ButtonLink>
            {canEdit && raw.status === "generated" && gate.data?.status !== "pending" ? <ActionForm action={requestGateAction} submitLabel="Request launch approval" hidden={{ gate_type: "store_launch", subject_id: id }} inline /> : null}
            {canEdit && raw.status === "launch_approved" ? <ActionForm action={setStoreStatusAction} submitLabel="Mark live" hidden={{ store_id: id, status: "live" }} confirm="Mark this store as live? Make sure policies are no longer placeholders." inline /> : null}
            {canEdit && raw.status === "live" ? <ActionForm action={setStoreStatusAction} submitLabel="Pause" variant="secondary" hidden={{ store_id: id, status: "paused" }} inline /> : null}
          </>
        }
      />
      {gate.data?.status === "pending" ? (
        <div className="mb-4">
          <Notice tone="warning" title="Launch approval pending">
            <Link href={`/approvals/${gate.data.id}`} className="text-accent hover:underline">
              Review the launch approval
            </Link>{" "}
            — an admin must approve before the store can go live.
          </Notice>
        </div>
      ) : null}
      {placeholders.length ? (
        <div className="mb-4">
          <Notice tone="warning">{placeholders.map((p) => p.title).join(" and ")} are placeholders. Replace them with reviewed policies before launch.</Notice>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Products" />
            <Table>
              <THead>
                <tr>
                  <TH>Product</TH>
                  <TH>Collection</TH>
                  <TH className="text-right">Price</TH>
                </tr>
              </THead>
              <TBody>
                {products.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`/stores/${id}/preview?product=${p.slug}`} className="text-ink hover:text-accent">
                        {p.title}
                      </Link>
                      <p className="font-mono text-[10px] text-muted">/products/{p.slug}</p>
                    </TD>
                    <TD className="text-xs">{collections.find((c) => c.slug === p.collection_slug)?.title ?? "—"}</TD>
                    <TD className="text-right tabular">{formatUsd(p.price)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
          <Card>
            <CardHeader title="Pages & collections" />
            <CardBody>
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {pages.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/stores/${id}/preview?page=${p.slug}`} className="text-ink-2 hover:text-accent">
                      {p.title}
                    </Link>{" "}
                    <span className="font-mono text-[10px] text-muted">/{p.slug === "home" ? "" : p.slug}</span>
                    {p.is_placeholder ? <Badge tone="warning" className="ml-1">placeholder</Badge> : null}
                  </li>
                ))}
                {collections.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/stores/${id}/preview?collection=${c.slug}`} className="text-ink-2 hover:text-accent">
                      Collection: {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Export" description="Downloads are generated from live data." />
            <CardBody>
              <ul className="space-y-3">
                {EXPORTS.map((e) => (
                  <li key={e.adapter}>
                    <a href={`/api/stores/${id}/export?adapter=${e.adapter}`} className="text-sm text-accent hover:underline">
                      {e.label}
                    </a>
                    <p className="text-xs text-muted">{e.note}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Publishing" />
            <CardBody className="space-y-3 text-xs">
              <KeyValue
                columns={1}
                items={[
                  { label: "Internal preview", value: "Always available" },
                  { label: "Shopify", value: shopifyConfigured ? "Configured — drafts can be published after launch approval" : "Requires provider connection (SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN)" },
                  { label: "Fulfill Engine", value: "Requires provider connection — awaiting API access" },
                ]}
              />
              {shopifyConfigured && roleAtLeast(ctx.role, "admin") && ["launch_approved", "live"].includes(raw.status) ? (
                <ActionForm action={publishShopifyAction} submitLabel="Publish drafts to Shopify" hidden={{ store_id: id }} confirm="Create draft products in your Shopify store?" />
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
