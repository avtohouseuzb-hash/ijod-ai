import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export const maxDuration = 60;
function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function tag(xml: string, name: string) {
  const match = xml.match(new RegExp("<(?:\\w+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?" + name + ">", "i"));
  return match ? decodeXml(match[1]) : "";
}
function imageFrom(xml: string, description: string) {
  return xml.match(/<(?:media:)?(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1] || xml.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1] || description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || null;
}
function youtubeFrom(text: string) {
  return text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/i)?.[0] || null;
}
export async function GET(request: Request) {
  const secret = process.env.NEWS_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase server config missing" }, { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: sources, error } = await db.from("news_sources").select("*").eq("enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let imported = 0;
  const newArticles: Array<{id:string;title:string;summary:string;source_url:string;image_url:string|null;video_url:string|null;source_name:string}> = [];
  for (const source of sources || []) {
    try {
      const response = await fetch(source.feed_url, { headers: { "User-Agent": "IJODAI-NewsBot/1.0", "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) continue;
      const xml = await response.text();
      const entries = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)].slice(0, 12);
      for (const entry of entries) {
        const block = entry[1];
        const title = tag(block, "title");
        const atomLink = block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || "";
        const link = tag(block, "link") || atomLink;
        if (!title || !/^https?:\/\//i.test(link)) continue;
        const descriptionRaw = tag(block, "description") || tag(block, "summary") || tag(block, "content");
        const summary = descriptionRaw.slice(0, 1400);
        const published = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
        const publishedAt = published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : new Date().toISOString();
        const image = imageFrom(block, descriptionRaw);
        const video = youtubeFrom(block + " " + descriptionRaw);
        const { data, error: insertError } = await db.from("news_articles").upsert({ source_id: source.id, title: title.slice(0, 500), summary, source_name: source.name, source_url: link, image_url: image, video_url: video, category: source.category, language: source.language, published_at: publishedAt, status: "published" }, { onConflict: "source_url", ignoreDuplicates: true }).select("id,title,summary,source_url,image_url,video_url,source_name");
        if (!insertError && data?.length) { imported += data.length; newArticles.push(...data); }
      }
    } catch (err) { console.error("News source failed", source.name, err); }
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && newArticles.length) {
    const { data: subscribers } = await db.from("news_telegram_subscriptions").select("chat_id").eq("enabled", true);
    const chats = new Set((subscribers || []).map(s => s.chat_id));
    if (process.env.NEWS_TELEGRAM_CHAT_ID) chats.add(process.env.NEWS_TELEGRAM_CHAT_ID);
    for (const article of newArticles) {
      const caption = ("📰 " + article.title + "\n\n" + (article.summary || "Batafsil ma’lumot manbada.") + "\n\nManba: " + article.source_name).slice(0, 1000);
      const buttons = [[{ text: "🔗 To‘liq yangilik", url: article.source_url }], ...(article.video_url ? [[{ text: "▶️ Videoni ko‘rish", url: article.video_url }]] : []), [{ text: "IJOD AI’da ochish", url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ijod-ai.vercel.app") + "/news" }]];
      for (const chatId of chats) {
        try {
          const method = article.image_url ? "sendPhoto" : "sendMessage";
          const payload = article.image_url ? { chat_id: chatId, photo: article.image_url, caption, reply_markup: { inline_keyboard: buttons } } : { chat_id: chatId, text: caption, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false };
          const sent = await fetch("https://api.telegram.org/bot" + botToken + "/" + method, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
          if (!sent.ok) console.error("Telegram send failed", await sent.text());
        } catch (sendError) { console.error("Telegram delivery failed", sendError); }
      }
    }
    await db.from("news_articles").update({ telegram_sent_at: new Date().toISOString() }).in("id", newArticles.map(a => a.id));
  }
  return NextResponse.json({ ok: true, imported, telegramPosts: newArticles.length });
}
