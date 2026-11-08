import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isNewsCronAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 60;

type Phase = "collect" | "process" | "cycle";

async function executePipeline(request: Request, adminAuthorized = false) {
  if (!adminAuthorized && !await isNewsCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase server config missing." }, { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false } });
  const requestUrl = new URL(request.url);
  const phase = (requestUrl.searchParams.get("phase") || "cycle") as Phase;
  if (!["collect", "process", "cycle"].includes(phase)) {
    return NextResponse.json({ error: "Noto‘g‘ri phase." }, { status: 400 });
  }

  const startedAt = new Date().toISOString();
  const { data: run, error: runInsertError } = await db.from("news_pipeline_runs")
    .insert({ phase, status: "running", details: { trigger: adminAuthorized ? "admin" : "cron" }, started_at: startedAt })
    .select("id").single();
  if (runInsertError || !run) {
    return NextResponse.json({ error: "Pipeline run yozilmadi: " + (runInsertError?.message || "unknown") }, { status: 500 });
  }

  const headers = { authorization: request.headers.get("authorization") || "" };
  const base = requestUrl.origin;
  const details: Record<string, unknown> = {};
  let finalStatus: "success" | "partial" | "failed" = "success";
  try {
    if (phase === "collect" || phase === "cycle") {
      const { data: state, error: stateError } = await db.from("news_pipeline_state")
        .select("source_offset").eq("id", true).maybeSingle();
      if (stateError) throw new Error("Pipeline state: " + stateError.message);
      const offset = requestUrl.searchParams.has("offset")
        ? Math.max(0, Number(requestUrl.searchParams.get("offset") || 0))
        : Math.max(0, Number(state?.source_offset || 0));
      const collectUrl = new URL(base + "/api/news/collect");
      collectUrl.searchParams.set("offset", String(offset));
      collectUrl.searchParams.set("limit", "25");
      const collectResponse = await fetch(collectUrl, {
        headers, cache: "no-store", signal: AbortSignal.timeout(50000)
      });
      const collectRaw = await collectResponse.text();
      let collect: any;
      try { collect = collectRaw ? JSON.parse(collectRaw) : {}; }
      catch { throw new Error("Collector JSON qaytarmadi: HTTP " + collectResponse.status + " " + collectRaw.slice(0, 300)); }
      if (!collectResponse.ok || collect.error) throw new Error("Collector: " + (collect.error || collectRaw.slice(0, 300)));
      details.collect = collect;
      const nextOffset = Number(collect.nextOffset ?? offset);
      const hasMore = Boolean(collect.hasMore);
      const { error: stateUpdateError } = await db.from("news_pipeline_state").update({
        source_offset: hasMore ? nextOffset : 0,
        last_collect_at: new Date().toISOString(),
        last_collect_result: collect,
        updated_at: new Date().toISOString()
      }).eq("id", true);
      if (stateUpdateError) throw new Error("Pipeline state update: " + stateUpdateError.message);
      if (collect.sourcesFailed > 0) finalStatus = "partial";
      if (phase === "collect") {
        const finishedAt = new Date().toISOString();
        await db.from("news_pipeline_runs").update({ status: finalStatus, details, finished_at: finishedAt })
          .eq("id", run.id);
        return NextResponse.json({ ok: finalStatus === "success", phase, offset, nextOffset, hasMore, details });
      }
    }

    if (phase === "process" || phase === "cycle") {
      const processResponse = await fetch(base + "/api/news/process", {
        headers, cache: "no-store", signal: AbortSignal.timeout(50000)
      });
      const processRaw = await processResponse.text();
      let processed: any;
      try { processed = processRaw ? JSON.parse(processRaw) : {}; }
      catch { throw new Error("Process JSON qaytarmadi: HTTP " + processResponse.status + " " + processRaw.slice(0, 300)); }
      if (!processResponse.ok || processed.error) throw new Error("Process: " + (processed.error || processRaw.slice(0, 300)));
      details.process = processed;
      if (processed.ok === false) finalStatus = "partial";
    }

    const finishedAt = new Date().toISOString();
    const { error: finishError } = await db.from("news_pipeline_runs").update({
      status: finalStatus, details, finished_at: finishedAt,
      error: finalStatus === "partial" ? "One or more sources or deliveries were not completed." : null
    }).eq("id", run.id);
    if (finishError) throw new Error("Pipeline history update: " + finishError.message);
    return NextResponse.json({ ok: finalStatus === "success", phase, details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "News pipeline failed";
    await db.from("news_pipeline_runs").update({
      status: "failed", error: message.slice(0, 2000), details, finished_at: new Date().toISOString()
    }).eq("id", run.id);
    return NextResponse.json({ ok: false, phase, error: message, details }, { status: 500 });
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
  if (!token || !url || !publicKey) return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user?.email) return NextResponse.json({ error: "Sessiya yaroqsiz." }, { status: 401 });
  const admins = (process.env.AI_NEWS_ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(user.email.toLowerCase())) return NextResponse.json({ error: "Admin huquqi talab qilinadi." }, { status: 403 });
  return executePipeline(request, true);
}
