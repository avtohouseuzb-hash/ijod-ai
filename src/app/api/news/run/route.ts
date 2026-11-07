import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const maxDuration = 60;

async function authorizedCronRequest(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const supplied = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!supplied) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return false;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("news_cron_auth").select("token_hash").eq("id", true).maybeSingle();
  if (error || !data?.token_hash) return false;
  const actual = createHash("sha256").update(supplied).digest();
  const expected = Buffer.from(String(data.token_hash), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function executePipeline(request: Request, skipCronAuth = false) {
  if (!skipCronAuth && !await authorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const base = new URL(request.url).origin;
  const headers = { authorization: authHeader };
  const requestUrl = new URL(request.url);
  const phase = requestUrl.searchParams.get("phase") || "collect";
  const offset = Math.max(0, Number(requestUrl.searchParams.get("offset") || 0));
  const steps: Record<string, unknown> = {};
  try {
    const readResponse = async (response: Response) => {
      const raw = await response.text();
      try { return JSON.parse(raw); }
      catch {
        return {
          error: "Ichki API JSON qaytarmadi.",
          httpStatus: response.status,
          responsePreview: raw.slice(0, 700) || "(bo‘sh javob)"
        };
      }
    };
    if (phase === "collect") {
      const collectUrl = new URL(base + "/api/news/collect");
      collectUrl.searchParams.set("offset", String(offset));
      collectUrl.searchParams.set("limit", "5");
      const collectResponse = await fetch(collectUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(20000) });
      const collect = await readResponse(collectResponse);
      steps.collect = collect;
      if (!collectResponse.ok || collect.error) {
        return NextResponse.json({ ok: false, phase: "collect", steps }, { status: 502 });
      }
      return NextResponse.json({ ok: Boolean(collect.ok), phase: "collect", offset, nextOffset: collect.nextOffset, hasMore: collect.hasMore, steps });
    }
    if (phase !== "process" && phase !== "cycle") return NextResponse.json({ error: "Noto‘g‘ri phase" }, { status: 400 });
    if (phase === "cycle") {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
      const { data: state } = await db.from("news_pipeline_state").select("source_offset").eq("id", true).maybeSingle();
      const sourceOffset = Math.max(0, Number(state?.source_offset || 0));
      const collectUrl = new URL(base + "/api/news/collect");
      collectUrl.searchParams.set("offset", String(sourceOffset));
      collectUrl.searchParams.set("limit", "10");
      const collectResponse = await fetch(collectUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(50000) });
      const collect = await readResponse(collectResponse);
      steps.collect = collect;
      if (!collectResponse.ok || collect.error) {
        return NextResponse.json({ ok: false, phase, steps }, { status: 502 });
      }
      const nextOffset = Number(collect.nextOffset || sourceOffset);
      const hasMore = Boolean(collect.hasMore);
      await db.from("news_pipeline_state").update({
        source_offset: hasMore ? nextOffset : 0,
        last_collect_at: new Date().toISOString(),
        last_collect_result: collect
      }).eq("id", true);
    }
    const processResponse = await fetch(base + "/api/news/process", { headers, cache: "no-store", signal: AbortSignal.timeout(45000) });
    const process = await readResponse(processResponse);
    steps.process = process;
    if (!processResponse.ok || process.error) {
      return NextResponse.json({ ok: false, phase, steps }, { status: 502 });
    }
    return NextResponse.json({ ok: Boolean(process.ok), phase, steps });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "News pipeline failed",
      steps
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return executePipeline(request);
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !publicKey || !serviceKey) {
    return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });
  }
  const auth = createClient(url, publicKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user?.email) return NextResponse.json({ error: "Sessiya yaroqsiz." }, { status: 401 });
  const admins = (process.env.AI_NEWS_ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(user.email.toLowerCase())) return NextResponse.json({ error: "Admin huquqi talab qilinadi." }, { status: 403 });

  const secret = process.env.NEWS_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "NEWS_CRON_SECRET yoki CRON_SECRET sozlanmagan." }, { status: 500 });
  const internalRequest = new Request(new URL(request.url), {
    method: "GET",
    headers: { authorization: "Bearer " + secret }
  });
  return executePipeline(internalRequest, true);
}
