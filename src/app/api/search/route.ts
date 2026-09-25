import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/server/context";
import { searchWorkspace } from "@/server/queries/search";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const ctx = await getContext();
  const results = await searchWorkspace(ctx, q);
  return NextResponse.json({ results }, { headers: { "cache-control": "no-store" } });
}
