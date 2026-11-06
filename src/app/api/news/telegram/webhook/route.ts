import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret && request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !key) return NextResponse.json({ error: "Bot server config missing" }, { status: 500 });
  const update = await request.json();
  const message = update.message;
  const chat = message?.chat;
  if (!chat?.id) return NextResponse.json({ ok: true });
  const chatId = String(chat.id);
  const text = String(message.text || "");
  const db = createClient(url, key, { auth: { persistSession: false } });
  if (text.startsWith("/start")) {
    await db.from("news_telegram_subscriptions").upsert({ chat_id: chatId, chat_type: chat.type || "private", username: message.from?.username || null, enabled: true, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
    await fetch("https://api.telegram.org/bot" + token + "/sendMessage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "Assalomu alaykum! IJOD AI News botiga xush kelibsiz. Har kungi yangiliklarni rasm, manba va mavjud video havolalari bilan yuboramiz. Obunani to‘xtatish uchun /stop buyrug‘ini yuboring." }) });
  } else if (text.startsWith("/stop")) {
    await db.from("news_telegram_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("chat_id", chatId);
    await fetch("https://api.telegram.org/bot" + token + "/sendMessage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: "Yangiliklar yuborilishi to‘xtatildi. Qayta obuna bo‘lish uchun /start yuboring." }) });
  } else if (text.startsWith("/latest")) {
    const { data } = await db.from("news_articles").select("title,source_url").eq("status", "published").order("published_at", { ascending: false }).limit(5);
    const body = (data || []).map((a, i) => (i + 1) + ". " + a.title + "\n" + a.source_url).join("\n\n") || "Hozircha yangilik yo‘q.";
    await fetch("https://api.telegram.org/bot" + token + "/sendMessage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: body, disable_web_page_preview: false }) });
  }
  return NextResponse.json({ ok: true });
}
