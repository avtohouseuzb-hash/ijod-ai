import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.NEWS_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = new URL(request.url).origin;
  const headers = { authorization: "Bearer " + secret };
  const steps: Record<string, unknown> = {};

  try {
    const collectResponse = await fetch(base + "/api/news/collect", { headers, cache: "no-store" });
    const collect = await collectResponse.json();
    steps.collect = collect;
    if (!collectResponse.ok) {
      return NextResponse.json({ ok: false, phase: "collect", steps }, { status: 502 });
    }

    const processResponse = await fetch(base + "/api/news/process", { headers, cache: "no-store" });
    const process = await processResponse.json();
    steps.process = process;
    if (!processResponse.ok) {
      return NextResponse.json({ ok: false, phase: "process", steps }, { status: 502 });
    }

    return NextResponse.json({ ok: true, steps });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "News pipeline failed",
      steps
    }, { status: 500 });
  }
}
