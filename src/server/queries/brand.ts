import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getContext } from "../context";

/** Loads a brand in the active workspace (RLS enforced) or 404s. Cached per request. */
export const getBrand = cache(async (id: string) => {
  const ctx = await getContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await ctx.db.from("brands").select("*").eq("id", id).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!res.data) notFound();
  return { ctx, brand: res.data };
});
