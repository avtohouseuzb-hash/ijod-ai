import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !publicKey || !serviceKey) return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });
  const auth = createClient(url, publicKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user?.email) return NextResponse.json({ error: "Sessiya yaroqsiz." }, { status: 401 });
  const admins = (process.env.AI_NEWS_ADMIN_EMAILS || "").split(",").map(v => v.trim().toLowerCase());
  if (!admins.includes(user.email.toLowerCase())) return NextResponse.json({ error: "Admin huquqi talab qilinadi." }, { status: 403 });
  let body: { sourceId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Noto‘g‘ri so‘rov." }, { status: 400 }); }
  if (!body.sourceId) return NextResponse.json({ error: "Manba tanlanmagan." }, { status: 400 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: source } = await db.from("news_sources").select("id,name,feed_url,category").eq("id", body.sourceId).eq("enabled", true).maybeSingle();
  if (!source) return NextResponse.json({ error: "Faol manba topilmadi." }, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY sozlanmagan." }, { status: 500 });
  try {
    const feed = await fetch(source.feed_url, { headers: { "User-Agent": "IJODAI-NewsBot/1.0" }, signal: AbortSignal.timeout(12000) });
    if (!feed.ok) return NextResponse.json({ error: "RSS HTTP " + feed.status }, { status: 502 });
    const xml = await feed.text();
    const entries = Array.from(xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi));
    if (!entries.length) return NextResponse.json({ error: "RSS item topilmadi." }, { status: 422 });
    const entry = entries[0][1];
    const get = (tag: string) => {
      const match = entry.match(new RegExp("<(?:\\w+:)?" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?" + tag + ">", "i"));
      return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").trim() : "";
    };
    const title = get("title");
    const summary = get("description") || get("summary") || get("content");
    const link = get("link") || entry.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || "";
    if (!title || !/^https?:\/\//i.test(link)) return NextResponse.json({ error: "Maqola sarlavhasi yoki havolasi topilmadi." }, { status: 422 });
    const model = process.env.IJOD_NEWS_TRANSLATION_MODEL || process.env.IJOD_NEWS_MODEL || "gpt-6-luna";
    const ai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model,
        instructions: "Translate and edit this news faithfully into Uzbek Latin, Uzbek Cyrillic and Russian. For each language provide a concise headline and factual 2-4 sentence summary. Preserve names, dates and numbers. Never invent facts. Return only JSON with keys uz_latn, uz_cyrl, ru, each with title and summary.",
        input: JSON.stringify({ source: source.name, title, text: summary.slice(0, 4000) }),
        max_output_tokens: 1200
      })
    });
    if (!ai.ok) return NextResponse.json({ error: "GPT API xatosi: " + (await ai.text()).slice(0, 600) }, { status: 502 });
    const result = await ai.json();
    const output = (result.output || []).flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || []).filter((part: { type?: string }) => part.type === "output_text").map((part: { text?: string }) => part.text || "").join("\n");
    const translated = JSON.parse(output.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "")) as Record<string, { title?: string; summary?: string }>;
    if (["uz_latn", "uz_cyrl", "ru"].some(k => !translated[k]?.title || !translated[k]?.summary)) return NextResponse.json({ error: "GPT barcha tillar uchun matn bermadi." }, { status: 502 });
    const image = entry.match(/<(?:media:)?(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1] || entry.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1] || null;
    const video = (entry + summary).match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/i)?.[0] || null;
    return NextResponse.json({ ok: true, model, source: { name: source.name, category: source.category, title, summary, url: link }, media: { imageUrl: image, videoUrl: video }, translations: { "uz-latn": translated.uz_latn, "uz-cyrl": translated.uz_cyrl, ru: translated.ru }, delivery: "preview_only" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sinov bajarilmadi." }, { status: 502 });
  }
}