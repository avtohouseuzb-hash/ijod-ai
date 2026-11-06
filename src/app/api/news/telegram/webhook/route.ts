import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function telegram(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) console.error("Telegram API error", method, await response.text());
}
const categories = ["O‘zbekiston", "Jahon", "AI va IT", "Biznes", "Iqtisodiyot", "Fan", "Sport"];
const languageKeyboard = { inline_keyboard: [[
  { text: "O‘zbekcha (Lotin)", callback_data: "news_lang:uz-latn" },
  { text: "Ўзбекча (Кирилл)", callback_data: "news_lang:uz-cyrl" },
  { text: "Русский", callback_data: "news_lang:ru" },
]] };
const languageNames: Record<string, string> = { "uz-latn": "O‘zbekcha (Lotin)", "uz-cyrl": "Ўзбекча (Кирилл)", ru: "Русский" };
const aboutKeyboard = { inline_keyboard: [
  [{ text: "📰 Yangiliklar bo‘limi", url: "https://ijod-ai.vercel.app/news" }],
  [{ text: "✨ IJOD AI Mini App", url: "https://ijod-ai.vercel.app/" }],
] };
const copy: Record<string, { saved: string; stopped: string; started: string; choose: string; topics: string; done: string; latestEmpty: string; about: string; help: string }> = {
  "uz-latn": {
    saved: "Til sozlamangiz saqlandi. Endi bot sizga shu tilda murojaat qiladi.",
    stopped: "Yangiliklar yuborilishi to‘xtatildi. Qayta obuna uchun /start yuboring.",
    started: "IJOD AI News botiga xush kelibsiz!", choose: "Yangiliklarni qaysi tilda olishni xohlaysiz?",
    topics: "Qaysi mavzulardagi yangiliklarni olishni xohlaysiz? Bir nechta mavzuni tanlashingiz mumkin.",
    done: "Mavzularingiz saqlandi. Tanlangan yo‘nalishlardagi yangi xabarlarni yuboramiz.",
    latestEmpty: "Tanlangan mavzularda hozircha yangilik yo‘q.",
    about: "IJOD AI — ijodkorlar va bizneslar uchun AI platforma. AI yordamida rasm, video, musiqa, ovoz va matn yarating, reklama hamda ijtimoiy tarmoqlar uchun kontent tayyorlang.\n\nIJOD AI News orqali O‘zbekiston va dunyo yangiliklarini tanlagan tilingiz va mavzularingizda kuzating.",
    help: "Buyruqlar:\n/start — til va mavzularni tanlash\n/language — tilni o‘zgartirish\n/topics — mavzularni o‘zgartirish\n/latest — so‘nggi yangiliklar\n/about — bot haqida\n/stop — xabarlarni to‘xtatish"
  },
  "uz-cyrl": {
    saved: "Тил созламаси сақланди. Энди бот сизга шу тилда мурожаат қилади.",
    stopped: "Янгиликлар юборилиши тўхтатилди. Қайта обуна учун /start юборинг.",
    started: "IJOD AI News ботига хуш келибсиз!", choose: "Янгиликларни қайси тилда олишни хоҳлайсиз?",
    topics: "Қайси мавзулардаги янгиликларни олишни хоҳлайсиз? Бир нечта мавзуни танлашингиз мумкин.",
    done: "Мавзуларингиз сақланди. Танланган йўналишлардаги янги хабарларни юборамиз.",
    latestEmpty: "Танланган мавзуларда ҳозирча янгилик йўқ.",
    about: "IJOD AI — ижодкорлар ва бизнеслар учун AI платформа. AI ёрдамида расм, видео, мусиқа, овоз ва матн яратинг, реклама ҳамда ижтимоий тармоқлар учун контент тайёрланг.\n\nIJOD AI News орқали Ўзбекистон ва жаҳон янгиликларини танлаган тилингиз ва мавзуларингизда кузатинг.",
    help: "Буйруқлар:\n/start — тил ва мавзуларни танлаш\n/language — тилни ўзгартириш\n/topics — мавзуларни ўзгартириш\n/latest — сўнгги янгиликлар\n/about — бот ҳақида\n/stop — хабарларни тўхтатиш"
  },
  ru: {
    saved: "Язык сохранён. Теперь бот будет обращаться к вам на этом языке.",
    stopped: "Рассылка остановлена. Чтобы подписаться снова, отправьте /start.",
    started: "Добро пожаловать в IJOD AI News!", choose: "На каком языке вы хотите получать новости?",
    topics: "Какие темы новостей вам интересны? Можно выбрать несколько.",
    done: "Ваши темы сохранены. Будем отправлять новости по выбранным направлениям.",
    latestEmpty: "Пока нет новостей по выбранным темам.",
    about: "IJOD AI — AI-платформа для творчества и бизнеса. Создавайте изображения, видео, музыку, голос и тексты с помощью ИИ, готовьте рекламу и контент для социальных сетей.\n\nВ IJOD AI News следите за новостями Узбекистана и мира на выбранном языке и по интересующим вас темам.",
    help: "Команды:\n/start — выбрать язык и темы\n/language — изменить язык\n/topics — изменить темы\n/latest — последние новости\n/about — о боте\n/stop — остановить рассылку"
  }
};
function topicKeyboard(selected: string[]) {
  return { inline_keyboard: [
    ...categories.reduce((rows: Array<Array<{text:string;callback_data:string}>>, category, index) => {
      if (index % 2 === 0) rows.push([]);
      rows[rows.length - 1].push({ text: (selected.includes(category) ? "✅ " : "▫️ ") + category, callback_data: "news_topic:" + index });
      return rows;
    }, []),
    [{ text: "✅ Tayyor / Готово", callback_data: "news_topics_done" }]
  ] };
}
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
    const data = String(callback.data || "");
    const { data: subscription } = await db.from("news_telegram_subscriptions").select("language,categories").eq("chat_id", chatId).maybeSingle();
    const lang = String(subscription?.language || "uz-latn");
    const msg = copy[lang] || copy["uz-latn"];
    if (data.startsWith("news_lang:")) {
      const language = data.slice("news_lang:".length);
      if (!(language in languageNames)) return NextResponse.json({ ok: true });
      await db.from("news_telegram_subscriptions").upsert({ chat_id: chatId, chat_type: callback.message?.chat?.type || "private", username: callback.from?.username || null, language, enabled: true, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
      const localized = copy[language];
      await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "OK" });
      await telegram(token, "sendMessage", { chat_id: chatId, text: localized.saved + "\n\n" + localized.about, reply_markup: aboutKeyboard });
      await telegram(token, "sendMessage", { chat_id: chatId, text: localized.topics, reply_markup: topicKeyboard(categories) });
    } else if (data.startsWith("news_topic:")) {
      const index = Number(data.slice("news_topic:".length));
      if (!Number.isInteger(index) || !categories[index]) return NextResponse.json({ ok: true });
      const current = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [...categories];
      const next = current.includes(categories[index]) ? current.filter(x => x !== categories[index]) : [...current, categories[index]];
      await db.from("news_telegram_subscriptions").update({ categories: next, updated_at: new Date().toISOString() }).eq("chat_id", chatId);
      await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "OK" });
      await telegram(token, "editMessageReplyMarkup", { chat_id: chatId, message_id: callback.message?.message_id, reply_markup: topicKeyboard(next) });
    } else if (data === "news_topics_done") {
      const selected = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [...categories];
      if (!selected.length) {
        await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "Kamida bitta mavzuni tanlang / Выберите хотя бы одну тему", show_alert: true });
      } else {
        await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "Saved" });
        await telegram(token, "sendMessage", { chat_id: chatId, text: msg.done + "\n\n/topics — mavzularni o‘zgartirish\n/language — tilni o‘zgartirish\n/latest — so‘nggi yangiliklar" });
      }
    }
    return NextResponse.json({ ok: true });
  }
  const message = update.message;
  const chat = message?.chat;
  if (!chat?.id) return NextResponse.json({ ok: true });
  const chatId = String(chat.id);
  const text = String(message.text || "");
  const { data: subscription } = await db.from("news_telegram_subscriptions").select("language,categories").eq("chat_id", chatId).maybeSingle();
  const language = String(subscription?.language || "uz-latn");
  const messages = copy[language] || copy["uz-latn"];
  if (text.startsWith("/start")) {
    await db.from("news_telegram_subscriptions").upsert({ chat_id: chatId, chat_type: chat.type || "private", username: message.from?.username || null, enabled: true, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.started + "\n\n" + messages.choose, reply_markup: languageKeyboard });
  } else if (text.startsWith("/about")) {
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.about, reply_markup: aboutKeyboard });
  } else if (text.startsWith("/help")) {
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.help });
  } else if (text.startsWith("/language")) {
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.choose, reply_markup: languageKeyboard });
  } else if (text.startsWith("/topics")) {
    const selected = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [...categories];
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.topics, reply_markup: topicKeyboard(selected) });
  } else if (text.startsWith("/stop")) {
    await db.from("news_telegram_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("chat_id", chatId);
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.stopped });
  } else if (text.startsWith("/latest")) {
    const selected = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [...categories];
    const { data } = await db.from("news_articles").select("id,title,summary,source_url,category").eq("status", "published").in("category", selected).order("published_at", { ascending: false }).limit(5);
    const ids = (data || []).map(a => a.id);
    const { data: translations } = ids.length ? await db.from("news_translations").select("article_id,title,summary").eq("language", language).in("article_id", ids) : { data: [] };
    const translated = new Map((translations || []).map(t => [t.article_id, t]));
    const body = (data || []).map((a, i) => { const t = translated.get(a.id); return (i + 1) + ". " + (t?.title || a.title) + "\n" + (t?.summary || a.summary || "") + "\n" + a.source_url; }).join("\n\n") || messages.latestEmpty;
    await telegram(token, "sendMessage", { chat_id: chatId, text: body.slice(0, 4000), disable_web_page_preview: false });
  }
  return NextResponse.json({ ok: true });
}
