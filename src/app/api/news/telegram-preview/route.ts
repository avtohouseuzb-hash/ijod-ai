import { NextResponse } from "next/server";
import { isNewsCronOrAdminAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 30;

const CHANNEL = "shopirlar";
const PAGE_URL = `https://t.me/s/${CHANNEL}`;

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();
}

function removeChannelPromotion(text: string) {
  return text
    .replace(/катталар канали\\s*[👉»:-]?.{0,100}(?:обуна бўлинг|обуна булинг|канали)/giu, " ")
    .replace(/👉\\s*@shopirlar\\b.{0,100}/giu, " ")
    .trim();
}

function isAdvertisement(text: string, html: string) {
  const normalized = removeChannelPromotion(text).toLocaleLowerCase("uz");
  const patterns = [
    /\b(reklama|hamkorlik|reklama huquqida|реклама|на правах рекламы)\b/i,
    /\b(chegirma|aksiya|promo.?kod|promokod|kupon|bonus|sovg[‘'’]?a|bepul yetkazib berish)\b/i,
    /\b(sotib oling|buyurtma bering|hoziroq xarid|murojaat qiling|bog‘laning|bog'laning|zakaz|заказ|купить|скидка)\b/i,
    /\b(narxi|atigi|so‘mga|сум|руб|доллар)\b/i,
    /(?:\+?998[\s()-]?\d{2}[\s()-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/,
    /\b(telegram|tel|telefon|aloqa|admin)\s*[:：-]/i,
    /t\.me\/(?:\+|joinchat|[a-z0-9_]{4,})/i,
    /\b(каналга обуна|подписывайтесь|подпишитесь|переходите по ссылке)\b/i,
  ];
  const hits = patterns.filter((pattern) => pattern.test(normalized) || pattern.test(html)).length;
  const commercialHashtags = /#(aksiya|chegirma|reklama|sale|скидка|реклама)\b/i.test(text);
  return hits >= 2 || (hits >= 1 && commercialHashtags);
}

function isLikelyNews(text: string) {
  if (text.length < 90) return false;
  const informational = /\b(xabar|ma’lum|ma'lum|xabarlarga ko‘ra|xabarlarga ko'ra|rasman|qaror|hodisa|voqea|vafot|jarohat|sodir bo‘ldi|e’lon qil|e'lon qil|boshlan|yakunlan|aniqlandi|uchrashuv|muzokara|tayinlandi|qabul qilindi|об этом|сообщил|произош|заявил)\b/i;
  return informational.test(text) || text.split(/[.!?]+/).filter((part) => part.trim().length > 35).length >= 2;
}

function extractPosts(html: string) {
  const blocks = html.match(/<div class="tgme_widget_message_wrap[\s\S]*?(?=<div class="tgme_widget_message_wrap|<\/body>)/gi) || [];
  return blocks.map((block) => {
    const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const text = textMatch ? stripHtml(textMatch[1]) : "";
    const postPath = block.match(/<a class="tgme_widget_message_date" href="([^"]+)"/i)?.[1]
      || block.match(/data-post="([^"]+)"/i)?.[1];
    const date = block.match(/<time[^>]*datetime="([^"]+)"/i)?.[1] || null;
    const image = block.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i)?.[1] || null;
    const views = block.match(/<span class="tgme_widget_message_views">([^<]+)</i)?.[1] || null;
    const url = postPath ? (postPath.startsWith("http") ? postPath : `https://t.me/${postPath.replace(/^\//, "")}`) : null;
    const ad = isAdvertisement(text, block);
    const cleanedText = removeChannelPromotion(text);
    const news = isLikelyNews(cleanedText);
    return { text: cleanedText, url, date, image, views: views ? stripHtml(views) : null, ad, news,
      decision: ad ? "blocked_ad" : news ? "candidate_news" : "not_news" };
  }).filter((post) => post.text);
}

export async function GET(request: Request) {
  if (!await isNewsCronOrAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(PAGE_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; IJODAI-NewsPreview/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Telegram sahifasi HTTP " + response.status, channel: CHANNEL }, { status: 502 });
    }
    const html = await response.text();
    const posts = extractPosts(html);
    const candidates = posts.filter((post) => post.decision === "candidate_news");
    return NextResponse.json({
      ok: true,
      mode: "preview_only",
      channel: CHANNEL,
      page: PAGE_URL,
      fetchedAt: new Date().toISOString(),
      totalParsed: posts.length,
      candidateNews: candidates.length,
      blockedAds: posts.filter((post) => post.decision === "blocked_ad").length,
      rejectedNonNews: posts.filter((post) => post.decision === "not_news").length,
      posts,
      note: "Sinov rejimi: hech qanday post news_articles jadvaliga yozilmaydi va Telegramga yuborilmaydi.",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Telegram sahifasini olishda xatolik.",
      channel: CHANNEL,
    }, { status: 502 });
  }
}
