import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;

function cronSecrets() {
  return [process.env.NEWS_CRON_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
}

async function executePipeline(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  if (!cronSecrets().some(secret => authHeader === "Bearer " + secret)) {
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
    if (phase !== "process") return NextResponse.json({ error: "Noto‘g‘ri phase" }, { status: 400 });
    const processResponse = await fetch(base + "/api/news/process", { headers, cache: "no-store", signal: AbortSignal.timeout(45000) });
    const processResult = await readResponse(processResponse);
    steps.process = processResult;
    if (!processResponse.ok || processResult.error) {
      return NextResponse.json({ ok: false, phase: "process", steps }, { status: 502 });
    }
    return NextResponse.json({
      ok: Boolean(processResult.ok),
      steps
    });
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
  return executePipeline(internalRequest);
}
