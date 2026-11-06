import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;

type Translation = { title: string; summary: string };
type Article = { id: string; title: string; summary: string | null; source_name: string; source_url: string; image_url: string | null; video_url: string | null; category: string; status: string };

export async function GET(request: Request) {
  const secret = process.env.NEWS_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!url || !key || !openaiKey)
    return NextResponse.json({ error: "Server config missing: Supabase yoki OpenAI kaliti." }, { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: articles, error } = await db.from("news_articles")
    .select("id,title,summary,source_name,source_url,image_url,video_url,category,status")
    .eq("status", "pending_translation").order("created_at", { ascending: true }).limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!articles?.length) return NextResponse.json({ ok: true, processed: 0, message: "Tarjima kutayotgan yangi maqola yo‘q." });

  const { data: subscribers } = await db.from("news_telegram_subscriptions")
    .select("chat_id,language,categories").eq("enabled", true);
  const chats = (subscribers || []).map((s: { chat_id: string; language?: string | null; categories?: string[] | null }) => ({
    chatId: String(s.chat_id), language: String(s.language || "uz-latn"),
    categories: Array.isArray(s.categories) ? s.categories : []
  }));
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && process.env.NEWS_TELEGRAM_CHAT_ID) chats.push({
    chatId: process.env.NEWS_TELEGRAM_CHAT_ID,
    language: process.env.NEWS_TELEGRAM_CHANNEL_LANGUAGE || "uz-latn", categories: []
  });

  const model = process.env.IJOD_NEWS_TRANSLATION_MODEL || process.env.IJOD_NEWS_MODEL || "gpt-6-luna";
  const outcomes: Array<{ id: string; translated: boolean; telegramSent: number; error?: string }> = [];

  for (const raw of articles as Article[]) {
    try {
      const { data: cached, error: cacheError } = await db.from("news_translations")
        .select("language,title,summary").eq("article_id", raw.id);
      if (cacheError) throw new Error(cacheError.message);
      const variants = new Map<string, Translation>((cached || []).map(t => [
        String(t.language), { title: String(t.title), summary: String(t.summary || "") }
      ]));
      const languages = ["uz-latn", "uz-cyrl", "ru"];
      if (languages.some(language => !variants.has(language))) {
        const ai = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + openaiKey },
          body: JSON.stringify({
            model,
            instructions: "You are IJOD AI News editor. Translate and edit faithfully into Uzbek Latin, Uzbek Cyrillic and Russian. Each version must have a concise, attractive headline and factual 2-3 sentence summary. Preserve names, dates, numbers and uncertainty. Do not invent facts or add unsupported context. Return only valid JSON with keys uz_latn, uz_cyrl, ru; each has title and summary strings.",
            input: JSON.stringify({ source: raw.source_name, title: raw.title, summary: raw.summary || "" }),
            text: { format: { type: "json_object" } },
            max_output_tokens: 1800
          })
        });
        if (!ai.ok) throw new Error("GPT API: " + (await ai.text()).slice(0, 400));
        const result = await ai.json();
        const output = (result.output || []).flatMap((item: { content?: Array<{ type?: string; text?: string }> } | null | undefined) => item?.content || [])
          .filter((part: { type?: string }) => part.type === "output_text")
          .map((part: { text?: string }) => part.text || "").join("\n").trim();
        const parsed = JSON.parse(output) as Record<string, Translation>;
        const pairs = [["uz-latn", "uz_latn"], ["uz-cyrl", "uz_cyrl"], ["ru", "ru"]] as const;
        for (const [language, keyName] of pairs) {
          const item = parsed[keyName];
          if (!item?.title || !item?.summary) throw new Error("GPT uch tilning barchasini qaytarmadi.");
          const row = { article_id: raw.id, language, title: item.title.slice(0, 500), summary: item.summary.slice(0, 1400) };
          const { error: saveError } = await db.from("news_translations").upsert(row, { onConflict: "article_id,language" });
          if (saveError) throw new Error("Tarjimani saqlash: " + saveError.message);
          variants.set(language, { title: row.title, summary: row.summary });
        }
      }

      const { error: publishError } = await db.from("news_articles").update({ status: "published" }).eq("id", raw.id);
      if (publishError) throw new Error("Maqolani nashr qilish: " + publishError.message);

      let telegramSent = 0;
      if (botToken) {
        const buttons = [[{ text: "🔗 To‘liq yangilik", url: raw.source_url }],
          ...(raw.video_url ? [[{ text: "▶️ Videoni ko‘rish", url: raw.video_url }]] : []),
          [{ text: "📰 IJOD AI News’da ochish", url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ijod-ai.vercel.app") + "/news" }]];
        for (const chat of chats) {
          if (chat.categories.length && !chat.categories.includes(raw.category)) continue;
          const item = variants.get(chat.language) || variants.get("uz-latn") || { title: raw.title, summary: raw.summary || "" };
          const caption = ("📰 " + item.title + "\n\n" + item.summary + "\n\nManba: " + raw.source_name).slice(0, 1000);
          const method = raw.image_url ? "sendPhoto" : "sendMessage";
          const payload = raw.image_url
            ? { chat_id: chat.chatId, photo: raw.image_url, caption, reply_markup: { inline_keyboard: buttons } }
            : { chat_id: chat.chatId, text: caption, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false };
          const sent = await fetch("https://api.telegram.org/bot" + botToken + "/" + method, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
          });
          const sentJson = await sent.json().catch(() => ({}));
          if (sent.ok && sentJson.ok) telegramSent++;
          else console.error("Telegram delivery failed", chat.chatId, sentJson);
        }
      }
      if (telegramSent > 0) await db.from("news_articles")
        .update({ telegram_sent_at: new Date().toISOString() }).eq("id", raw.id);
      outcomes.push({ id: raw.id, translated: true, telegramSent });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Processing failed";
      console.error("News processing failed", raw.id, message);
      outcomes.push({ id: raw.id, translated: false, telegramSent: 0, error: message });
    }
  }

  return NextResponse.json({
    ok: outcomes.every(x => x.translated), phase: "translate_and_deliver",
    model, processed: outcomes.length, translated: outcomes.filter(x => x.translated).length,
    telegramMessagesSent: outcomes.reduce((sum, x) => sum + x.telegramSent, 0), outcomes
  });
}
