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
};

function countMatches(xml: string, pattern: RegExp) {
  return (xml.match(pattern) || []).length;
}

function parseFeed(xml: string, contentType: string) {
  const sample = xml.slice(0, 12000).toLowerCase();
  const isXml = /xml|rss|atom|rdf/i.test(contentType) || /^\s*(<\?xml|<rss|<feed|<rdf:rdf)/i.test(xml);
  const itemCount = countMatches(xml, /<(?:item|entry)(?:\s[^>]*)?>/gi);
  const titles = [...xml.matchAll(/<(?:title)(?:\s[^>]*)?>([\s\S]*?)<\/title>/gi)]
    .map((match) => match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const hasFeedRoot = /<(?:rss|feed|rdf:rdf)(?:\s|>)/i.test(xml);
  const homepageLike = !hasFeedRoot && !/<(?:item|entry)\b/i.test(xml) &&
    (/<html\b/i.test(sample) || /<!doctype html/i.test(sample));
  const dates = [...xml.matchAll(/<(?:pubDate|published|updated|dc:date)>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/gi)]
    .map((match) => new Date(match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()))
    .filter((date) => !Number.isNaN(date.getTime()));
  const latestItemAt = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString() : null;
  return {
    validXml: isXml && hasFeedRoot && !homepageLike,
    itemCount,
    sampleTitles: titles.slice(0, 3),
    latestItemAt,
    reason: !isXml ? "XML/RSS javobi emas" : homepageLike ? "RSS o‘rniga HTML sahifa qaytdi" :
      !hasFeedRoot ? "RSS/Atom feed root topilmadi" : itemCount === 0 ? "Feed bor, lekin item/entry yo‘q" : null,
  };
}

async function checkOne(source: Source, db: ReturnType<typeof createClient<NewsSourcesDb>>) {
  const checkedAt = new Date().toISOString();
  try {
    const parsed = new URL(source.feed_url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Faqat HTTP/HTTPS manbalar qo‘llanadi");
    const response = await fetch(source.feed_url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; IJODAI-RSSHealthCheck/1.0)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error("Feed hajmi 2 MB limitdan katta");
    const result = parseFeed(body, response.headers.get("content-type") || "");
    if (!result.validXml || result.itemCount === 0) throw new Error(result.reason || "Feed ichida yangilik topilmadi");
    const { error } = await db.from("news_sources").update({
      last_checked_at: checkedAt,
      last_check_status: "healthy",
      last_check_error: null,
      last_item_count: result.itemCount,
      last_item_at: result.latestItemAt,
    }).eq("id", source.id);
    if (error) throw new Error("DB update: " + error.message);
    return { id: source.id, name: source.name, category: source.category, url: source.feed_url,
      status: "healthy", httpStatus: response.status, itemCount: result.itemCount,
      latestItemAt: result.latestItemAt, sampleTitles: result.sampleTitles };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Noma’lum xatolik";
    await db.from("news_sources").update({
      last_checked_at: checkedAt,
      last_check_status: "failed",
      last_check_error: message.slice(0, 500),
      last_item_count: 0,
    }).eq("id", source.id);
    return { id: source.id, name: source.name, category: source.category, url: source.feed_url,
      status: "failed", error: message };
  }
}

export async function GET(request: Request) {
  if (!await isNewsCronOrAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase server config missing" }, { status: 500 });
  const params = new URL(request.url).searchParams;
  const offset = Math.max(0, Number(params.get("offset") || 0));
  const limit = Math.min(10, Math.max(1, Number(params.get("limit") || 10)));
  const db = createClient<NewsSourcesDb>(url, key, { auth: { persistSession: false } });
  const { data: sources, error } = await db.from("news_sources")
    .select("id,name,feed_url,category")
    .eq("source_group", "Excel 2026-11-10 - pending verification")
    .order("category").order("name")
    .range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = sources || [];
  const results = [];
  for (let i = 0; i < rows.length; i += 3) {
    const batch = rows.slice(i, i + 3);
    results.push(...await Promise.all(batch.map((source) => checkOne(source, db))));
  }
  const healthy = results.filter((row) => row.status === "healthy").length;
  return NextResponse.json({
    ok: true,
    mode: "check_only_no_auto_enable",
    offset,
    limit,
    checked: results.length,
    healthy,
    failed: results.length - healthy,
    nextOffset: offset + rows.length,
    hasMore: rows.length === limit,
    results,
    note: "Manbalar avtomatik faollashtirilmaydi. Faqat HTTP/RSS holati tekshiriladi.",
  });
}
