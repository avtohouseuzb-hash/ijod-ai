import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function tag(xml: string, name: string) {
  const match = xml.match(new RegExp("<(?:\\w+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?" + name + ">", "i"));
  return match ? decodeXml(match[1]) : "";
}
function imageFrom(xml: string, description: string) {
  return xml.match(/<(?:media:)?(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1]
    || xml.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1]
    || description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || null;
}
function imageFromMarkup(markup: string) {
  const unwrapped = markup.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const candidates = [
    unwrapped.match(/<(?:media:)?(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1],
    unwrapped.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1],
    unwrapped.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i)?.[1],
    unwrapped.match(/<itunes:image[^>]+href=["']([^"']+)["']/i)?.[1]
  ];
  return candidates.find(value => value && /^https?:\/\//i.test(value)) || null;
}
function absoluteImage(value: string, baseUrl: string) {
  const cleaned = value.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").trim();
  try {
    const parsed = new URL(cleaned, baseUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch { return null; }
}
async function articleOgImage(articleUrl: string) {
  try {
    const response = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IJODAI-NewsBot/1.0)", "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 400000);
    const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
    for (const meta of metaTags) {
      const key = meta.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (!key || !["og:image", "og:image:url", "twitter:image", "twitter:image:src"].includes(key)) continue;
      const content = meta.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
      if (content) {
        const image = absoluteImage(content, response.url || articleUrl);
        if (image) return image;
      }
    }
    return null;
  } catch { return null; }
}
function youtubeFrom(text: string) {
  return text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/i)?.[0] || null;
}
function videoFrom(xml: string, description: string) {
  const candidates = [
    xml.match(/<(?:media:)?content[^>]+url=["']([^"']+)["'][^>]+type=["']video\//i)?.[1],
    xml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']video\//i)?.[1],
    xml.match(/<link[^>]+type=["']video\/[^"']+["'][^>]+href=["']([^"']+)["']/i)?.[1],
    youtubeFrom(xml + " " + description)
  ];
  return candidates.find(value => value && /^https?:\/\//i.test(value)) || null;
}
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }));
  return results;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const validSecrets = [process.env.NEWS_CRON_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
  if (!validSecrets.some(secret => authHeader === "Bearer " + secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase server config missing" }, { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: sources, error } = await db.from("news_sources")
    .select("id,name,feed_url,category,language").eq("enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await mapLimit(sources || [], 10, async (source) => {
    try {
      const response = await fetch(source.feed_url, {
        headers: { "User-Agent": "IJODAI-NewsBot/1.0", "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(9000)
      });
      if (!response.ok) return { source: source.name, ok: false, reason: "HTTP " + response.status, found: 0, inserted: 0 };
      const xml = await response.text();
      const entries = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].slice(0, 8);
      const rows = entries.flatMap((entry) => {
        const block = entry[1];
        const title = tag(block, "title");
        const atomLink = block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || "";
        const link = tag(block, "link") || atomLink;
        if (!title || !/^https?:\/\//i.test(link)) return [];
        const raw = tag(block, "description") || tag(block, "summary") || tag(block, "content");
        const published = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
        return [{
          source_id: source.id, title: title.slice(0, 500), summary: raw.slice(0, 1400),
          source_name: source.name, source_url: link, image_url: imageFrom(block, raw) || imageFromMarkup(raw),
          video_url: videoFrom(block, raw), media_type: "none", category: source.category,
          language: source.language || "en",
          published_at: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : new Date().toISOString(),
          status: "pending_translation"
        }];
      });
      if (!rows.length) return { source: source.name, ok: true, found: 0, inserted: 0 };
      const rowsWithImages = await mapLimit(rows, 4, async (row, index) => {
        const image = row.image_url || (index < 5 ? await articleOgImage(row.source_url) : null);
        return {
          ...row,
          image_url: image,
          media_type: image && row.video_url ? "both" : image ? "image" : row.video_url ? "video" : "none"
        };
      });
      const { data, error: upsertError } = await db.from("news_articles")
        .upsert(rowsWithImages, { onConflict: "source_url", ignoreDuplicates: true })
        .select("id");
      if (upsertError) return { source: source.name, ok: false, reason: upsertError.message, found: rows.length, inserted: 0 };
      // Existing duplicate articles may have been collected before image extraction existed.
      // Enrich only the image field so published/translated status and content remain untouched.
      for (const row of rowsWithImages) {
        if (!row.image_url) continue;
        await db.from("news_articles").update({ image_url: row.image_url })
          .eq("source_url", row.source_url).is("image_url", null);
      }
      return { source: source.name, ok: true, found: rows.length, inserted: data?.length || 0 };
    } catch (e) {
      return { source: source.name, ok: false, reason: e instanceof Error ? e.message : "Fetch failed", found: 0, inserted: 0 };
    }
  });

  // Backfill images for recently collected articles that had no image in their RSS feed.
  // This also repairs older records that were stored before richer image extraction was added.
  const { data: missingImages } = await db.from("news_articles")
    .select("id,source_url").is("image_url", null)
    .order("published_at", { ascending: false }).limit(30);
  let imagesRecovered = 0;
  if (missingImages?.length) {
    const recovered = await mapLimit(missingImages, 4, async (article: { id: string; source_url: string }) => {
      const image = await articleOgImage(article.source_url);
      if (!image) return false;
      const { error: imageError } = await db.from("news_articles").update({ image_url: image })
        .eq("id", article.id).is("image_url", null);
      return !imageError;
    });
    imagesRecovered = recovered.filter(Boolean).length;
  }

  const okSources = results.filter(r => r.ok).length;
  const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const found = results.reduce((sum, r) => sum + r.found, 0);
  const failed = results.filter(r => !r.ok);
  return NextResponse.json({
    ok: failed.length === 0, phase: "collect",
    sourcesTotal: sources?.length || 0, sourcesChecked: results.length, sourcesOk: okSources,
    sourcesFailed: failed.length, itemsFound: found, articlesInserted: inserted,
    duplicateItemsSkipped: Math.max(0, found - inserted), failedSources: failed
  });
}
