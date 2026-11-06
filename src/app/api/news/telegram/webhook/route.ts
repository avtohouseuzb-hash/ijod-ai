import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function telegram(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) console.error("Telegram API error", method, await response.text());
}
const languageKeyboard = {
  inline_keyboard: [[
    { text: "O‘zbekcha (Lotin)", callback_data: "news_lang:uz-latn" },
    { text: "Ўзбекча (Кирилл)", callback_data: "news_lang:uz-cyrl" },
    { text: "Русский", callback_data: "news_lang:ru" },
  ]],
};
const languageNames: Record<string, string> = {
  "uz-latn": "O‘zbekcha (Lotin)", "uz-cyrl": "Ўзбекча (Кирилл)", ru: "Русский",
};
const messages: Record<string, { saved: string; stopped: string; started: string; choose: string; latestEmpty: string }> = {
  "uz-latn": { saved: "Til sozlamangiz saqlandi. Endi yangiliklar shu tilda yuboriladi.", stopped: "Yangiliklar yuborilishi to‘xtatildi. Qayta obuna uchun /start yuboring.", started: "IJOD AI News botiga xush kelibsiz!", choose: "Yangiliklarni qaysi tilda olishni xohlaysiz?", latestEmpty: "Hozircha yangilik yo‘q." },
  "uz-cyrl": { saved: "Тил созламangiz сақланди. Энди янгиликлар шу тилда юборилади.", stopped: "Янгиликлар юборилиши тўхтатилди. Қайта обуна учун /start юборинг.", started: "IJOD AI News ботига хуш келибсиз!", choose: "Янгиликларни қайси тилда олишни хоҳлайсиз?", latestEmpty: "Ҳозирча янгилик йўқ." },
  ru: { saved: "Язык сохранён. Теперь новости будут приходить на этом языке.", stopped: "Рассылка остановлена. Чтобы подписаться снова, отправьте /start.", started: "Добро пожаловать в IJOD AI News!", choose: "На каком языке вы хотите получать новости?", latestEmpty: "Пока новостей нет." },
};

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret && request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !key) return NextResponse.json({ error: "Bot server config missing" }, { status: 500 });
  const update = await request.json();
  const db = createClient(url, key, { auth: { persistSession: false } });

  if (update.callback_query) {
    const callback = update.callback_query;
    const chatId = String(callback.message?.chat?.id || "");
    const language = String(callback.data || "").replace("news_lang:", "");
    if (chatId && language in languageNames) {
      await db.from("news_telegram_subscriptions").upsert({
        chat_id: chatId, chat_type: callback.message?.chat?.type || "private",
        username: callback.from?.username || null, language, enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "chat_id" });
      await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "OK" });
      await telegram(token, "sendMessage", { chat_id: chatId, text: messages[language].saved });
    }
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  const chat = message?.chat;
  if (!chat?.id) return NextResponse.json({ ok: true });
  const chatId = String(chat.id);
  const text = String(message.text || "");
  const { data: subscription } = await db.from("news_telegram_subscriptions").select("language").eq("chat_id", chatId).maybeSingle();
  const language = subscription?.language || "uz-latn";
  const copy = messages[language] || messages["uz-latn"];

  if (text.startsWith("/start")) {
    await db.from("news_telegram_subscriptions").upsert({
      chat_id: chatId, chat_type: chat.type || "private",
      username: message.from?.username || null, enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "chat_id" });
    await telegram(token, "sendMessage", {
      chat_id: chatId, text: copy.started + "\n\n" + copy.choose,
      reply_markup: languageKeyboard,
    });
  } else if (text.startsWith("/language")) {
    await telegram(token, "sendMessage", { chat_id: chatId, text: copy.choose, reply_markup: languageKeyboard });
  } else if (text.startsWith("/stop")) {
    await db.from("news_telegram_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("chat_id", chatId);
    await telegram(token, "sendMessage", { chat_id: chatId, text: copy.stopped });
  } else if (text.startsWith("/latest")) {
    const { data } = await db.from("news_articles").select("id,title,summary,source_url").eq("status", "published").order("published_at", { ascending: false }).limit(5);
    const ids = (data || []).map(a => a.id);
    const { data: translations } = ids.length
      ? await db.from("news_translations").select("article_id,title,summary").eq("language", language).in("article_id", ids)
      : { data: [] };
    const translated = new Map((translations || []).map(t => [t.article_id, t]));
    const body = (data || []).map((a, i) => {
      const t = translated.get(a.id);
      return (i + 1) + ". " + (t?.title || a.title) + "\n" + (t?.summary || a.summary || "") + "\n" + a.source_url;
    }).join("\n\n") || copy.latestEmpty;
    await telegram(token, "sendMessage", { chat_id: chatId, text: body.slice(0, 4000), disable_web_page_preview: false });
  }
  return NextResponse.json({ ok: true });
}
