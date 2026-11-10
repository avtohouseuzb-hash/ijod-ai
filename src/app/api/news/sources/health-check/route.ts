import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isNewsCronOrAdminAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 60;

type NewsSourcesDb = any;

type Source = {
  id: string;
  name: string;
  feed_url: string;
  category: string;
  enabled: boolean;
};

function inspectFeed(xml: string) {
  const trimmed = xml.trim();
  const isFeed = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<(?:rss|feed|rdf:RDF)(?:\s|>)/i.test(trimmed)
    || /<(?:rss|feed|rdf:RDF)(?:\s|>)/i.test(trimmed.slice(0, 4000));
  if (!isFeed) return { status: "invalid_feed", detail: "HTTP javobi RSS/Atom XML formatida emas.", itemCount: 0, latestAt: null as string | null };
  const itemCount = (trimmed.match(/<(?:item|entry)(?:\s|>)/gi) || []).length;
  const dates = [...trimmed.matchAll(/<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/gi)]
    .slice(0, 30)
    .map((match) => match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim())
    .map((value) => {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
    })
    .filter((value): value is string => Boolean(value))
    .sort()
    .reverse();
  return {
    status: itemCount > 0 ? "ok" : "empty_feed",
    detail: itemCount > 0 ? "RSS/Atom formati to‘g‘ri." : "RSS XML ochildi, lekin item/entry topilmadi.",
    itemCount,
    latestAt: dates[0] || null,
  };
}

async function checkOne(source: Source, db: ReturnType<typeof createClient<NewsSourcesDb>>) {
  const checkedAt = new Date().toISOString();
  let status = "network_error";
  let detail = "Manbaga ulanish amalga oshmadi.";
  let itemCount = 0;
  let latestAt: string | null = null;
  try {
    const response = await fetch(source.feed_url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; IJODAI-RSSHealth/1.0)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      status = "http_error";
      detail = "HTTP " + response.status + " " + response.statusText;
    } else {
      const xml = await response.text();
      const inspected = inspectFeed(xml);
      status = inspected.status;
      detail = inspected.detail + " Yakuniy URL: " + response.url;
      itemCount = inspected.itemCount;
      latestAt = inspected.latestAt;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Noma’lum tarmoq xatosi.";
    status = /timeout|abort/i.test(message) ? "timeout" : "network_error";
    detail = message.slice(0, 500);
  }

  const { error } = await db.from("news_sources").update({
    last_checked_at: checkedAt,
    last_check_status: status,
    last_check_detail: detail,
    last_item_count: itemCount,
    last_item_at: latestAt,
  }).eq("id", source.id);
  if (error) detail += " | DB update xatosi: " + error.message;

  return {
    id: source.id,
    name: source.name,
    category: source.category,
    feedUrl: source.feed_url,
    wasEnabled: source.enabled,
    status,
    itemCount,
    latestItemAt: latestAt,
    detail,
  };
}

export async function GET(request: Request) {
  if (!await isNewsCronOrAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase server config missing." }, { status: 500 });

  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Number(params.get("offset") || 0));
  const limit = Math.min(25, Math.max(1, Number(params.get("limit") || 10)));
  const group = params.get("group") || "all";
  const db = createClient<NewsSourcesDb>(url, key, { auth: { persistSession: false } });
  let query = db.from("news_sources")
    .select("id,name,feed_url,category,enabled")
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (group === "excel") query = query.eq("source_group", "Excel 2026-11-10 - pending verification");
  if (group === "active") query = query.eq("enabled", true);
  if (group === "disabled") query = query.eq("enabled", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sources = (data || []) as Source[];
  const results: Awaited<ReturnType<typeof checkOne>>[] = [];
  for (let index = 0; index < sources.length; index += 4) {
    const batch = sources.slice(index, index + 4);
    const checked = await Promise.all(batch.map((source) => checkOne(source, db)));
    results.push(...checked);
  }
  const summary = results.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return NextResponse.json({
    ok: true,
    group,
    offset,
    checked: results.length,
    nextOffset: results.length === limit ? offset + limit : null,
    summary,
    results,
    note: "Tekshiruv manbalarni faollashtirmaydi yoki o‘chirmaydi; faqat diagnostika ustunlarini yangilaydi.",
  });
}
