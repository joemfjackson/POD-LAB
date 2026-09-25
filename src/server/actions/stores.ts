"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { shopifyAdapter } from "@/providers/commerce/adapters";
import { ProviderNotConfiguredError } from "@/providers/errors";
import { requireContext } from "../context";
import { buildStorePackage } from "../services/exports";
import { UserFacingError, describeDbError } from "../services/errors";
import { toActionError, type ActionResult } from "./result";

export async function setStoreStatusAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("store_id"));
    const status = z.enum(["live", "paused", "archived", "generated"]).parse(fd.get("status"));
    const res = await ctx.db.from("stores").update({ status }).eq("id", id).select("code, brand_id");
    if (res.error || !res.data?.length) throw new UserFacingError(describeDbError(res.error, "Could not update the store."));
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: `store.${status}`, subject_type: "store", subject_id: id, brand_id: res.data[0]!.brand_id, summary: `${ctx.user.displayName} set store ${res.data[0]!.code} to ${status}` });
    revalidatePath(`/stores/${id}`);
    return { ok: true, message: `Store is now ${status}.` };
  } catch (e) {
    return toActionError(e);
  }
}

/** Publishes draft products to Shopify. Requires launch approval and configured credentials. */
export async function publishShopifyAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("providers.configure");
    const id = z.uuid().parse(fd.get("store_id"));
    const store = await ctx.db.from("stores").select("status").eq("id", id).single();
    if (store.error) throw new UserFacingError("Store not found.");
    if (!["launch_approved", "live"].includes(store.data.status)) throw new UserFacingError("Publishing requires an approved store launch.");
    const env = serverEnv();
    const adapter = shopifyAdapter({ storeDomain: env.SHOPIFY_STORE_DOMAIN, accessToken: env.SHOPIFY_ADMIN_ACCESS_TOKEN, apiVersion: env.SHOPIFY_API_VERSION });
    const pkg = await buildStorePackage(ctx.db, id);
    const result = await adapter.publish!(pkg);
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "store.published_shopify", subject_type: "store", subject_id: id, summary: `${ctx.user.displayName} published ${result.externalIds.length} draft product(s) to Shopify` });
    return { ok: true, message: result.message };
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}
