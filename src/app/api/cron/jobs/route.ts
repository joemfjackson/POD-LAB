import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { drainQueue } from "@/agents/runtime/runner";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vercel Cron: recovers stale jobs and drains queued/retrying agent jobs. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const results = await drainQueue(createSupabaseAdminClient(), 10);
  return NextResponse.json({ processed: results.length, results: results.map((r) => ({ job: r.jobId, status: r.status })) });
}
