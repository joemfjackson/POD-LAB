"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { WORKSPACE_COOKIE, getContext } from "../context";

export async function switchWorkspaceAction(workspaceId: string) {
  const id = z.uuid().parse(workspaceId);
  const ctx = await getContext();
  if (!ctx.memberships.some((m) => m.workspace.id === id)) throw new Error("Not a member of that workspace");
  (await cookies()).set(WORKSPACE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
