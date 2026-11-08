import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isNewsCronOrAdminAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 20;

type TestType = "motivation" | "weather" | "currency" | "news";
type Recipient = { chat_id: string; chat_type: string; language: string; categories: string[] };

function cyrillic(value: string) {
  const pairs: Array<[string, string]> = [["o‘","ў"],["g‘","ғ"],["sh","ш"],["ch","ч"],["yo","ё"],["yu","ю"],["ya","я"],["ng","нг"],["a","а"],["b","б"],["d","д"],["e","е"],["f","ф"],["g","г"],["h","ҳ"],["i","и"],["j","ж"],["k","к"],["l","л"],["m","м"],["n","н"],["o","о"],["p","п"],["q","қ"],["r","р"],["s","с"],["t","т"],["u","у"],["v","в"],["x","х"],["y","й"],["z","з"],["c","ц"]];
  let result = value;
  for (const [latin, cyr] of pairs) result = result.replace(new RegExp(latin, "gi"), match => match === match.toUpperCase() ? cyr.toUpperCase() : cyr);
  return result;
}

async function sendTelegram(token: string, chatId: string, message: string) {
  const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await response.json().catch(() => ({})) as { ok?: boolean; description?: string; result?: { message_id?: number } };
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram xabarni qabul qilmadi.");
  return result.result?.message_id ?? null;
}

async function getRecipient(db: any, chatId: string, channelId: string | undefined) {
  if (channelId && chatId === channelId) {
    return { chat_id: chatId, chat_type: "channel", language: process.env.NEWS_TELEGRAM_CHANNEL_LANGUAGE || "uz-latn", categories: [] } as Recipient;
  }
  const { data, error } = await db.from("news_telegram_subscriptions")
    .select("chat_id,chat_type,language,categories").eq("enabled", true).eq("chat_id", chatId).maybeSingle();
  if (error) throw new Error("Telegram obunachisini tekshirib bo‘lmadi: " + error.message);
  return data as Recipient | null;
}

function motivationMessage(language: string) {
  if (language === "ru") return "🧪 ТЕСТОВОЕ СООБЩЕНИЕ · МОТИВАЦИЯ\n\nДоброе утро! ☀️ Большие результаты начинаются с маленьких последовательных шагов. Выберите сегодня одну важную задачу и спокойно сделайте первый шаг.\n\nПусть день будет продуктивным! 🌿";
  const text = "🧪 TEST XABAR · MOTIVATSIYA\n\nXayrli tong! ☀️ Katta natijalar har kuni bajarilgan kichik va izchil qadamlardan boshlanadi. Bugun bitta muhim vazifani tanlang va unga birinchi qadamni tashlang.\n\nKuningiz unumli o‘tsin! 🌿";
  return language === "uz-cyrl" ? cyrillic(text) : text;
}

async function buildWeatherMessage(city: string, latitude: number, longitude: number, language: string) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "precipitation_sum,temperature_2m_max,temperature_2m_min",
    timezone: "Asia/Tashkent", forecast_days: "1"
  }).toString();
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Open-Meteo ob-havo xizmati javob bermadi: HTTP " + response.status);
  const data = await response.json() as {
    current?: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; time: string };
    daily?: { precipitation_sum?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  };
  if (!data.current || !data.daily) throw new Error("Ob-havo ma’lumoti to‘liq emas.");
  const c = data.current, d = data.daily;
  const condition = c.weather_code === 0 ? "ochiq" : c.weather_code <= 3 ? "qisman bulutli" : c.weather_code <= 48 ? "tumanli" : c.weather_code <= 67 ? "yomg‘irli" : c.weather_code <= 77 ? "qorli" : c.weather_code <= 82 ? "jala" : "momaqaldiroqli";
  const conditionRu = c.weather_code === 0 ? "ясно" : c.weather_code <= 3 ? "переменная облачность" : c.weather_code <= 48 ? "туман" : c.weather_code <= 67 ? "дождь" : c.weather_code <= 77 ? "снег" : c.weather_code <= 82 ? "ливень" : "гроза";
  if (language === "ru") return "🧪 ТЕСТ · ПОГОДА — " + city + "\n\n🌡 Сейчас: " + Math.round(c.temperature_2m) + "°C (ощущается как " + Math.round(c.apparent_temperature) + "°C)\n📍 Условия: " + conditionRu + "\n🌡 За день: " + Math.round(d.temperature_2m_min?.[0] ?? c.temperature_2m) + "…"+ Math.round(d.temperature_2m_max?.[0] ?? c.temperature_2m) + "°C\n💨 Ветер: " + Math.round(c.wind_speed_10m) + " км/ч\n🌧 Осадки: " + (d.precipitation_sum?.[0] ?? 0) + " мм\n\nИсточник: Open-Meteo · " + c.time;
  let text = "🧪 TEST XABAR · OB-HAVO — " + city + "\n\n🌡 Hozir: " + Math.round(c.temperature_2m) + "°C (his qilinishi " + Math.round(c.apparent_temperature) + "°C)\n📍 Holat: " + condition + "\n🌡 Bugun: " + Math.round(d.temperature_2m_min?.[0] ?? c.temperature_2m) + "…"+ Math.round(d.temperature_2m_max?.[0] ?? c.temperature_2m) + "°C\n💨 Shamol: " + Math.round(c.wind_speed_10m) + " km/soat\n🌧 Yog‘ingarchilik: " + (d.precipitation_sum?.[0] ?? 0) + " mm\n\nManba: Open-Meteo · " + c.time;
  if (language === "uz-cyrl") text = cyrillic(text);
  return text;
}

async function buildCurrencyMessage(language: string) {
  const response = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/", { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Markaziy bank kurslari olinmadi: HTTP " + response.status);
  const rates = await response.json() as Array<{ Ccy: string; Rate: string; Nominal: string; Date: string }>;
  const codes = ["USD", "EUR", "RUB", "GBP", "CNY", "KZT"];
  const selected = codes.map(code => rates.find(rate => rate.Ccy === code)).filter((rate): rate is NonNullable<typeof rate> => Boolean(rate));
  if (!selected.some(rate => rate.Ccy === "USD")) throw new Error("USD kursi Markaziy bank javobida topilmadi.");
  const date = selected[0]?.Date || "";
  if (language === "ru") return "🧪 ТЕСТ · ОФИЦИАЛЬНЫЕ КУРСЫ ЦБ УЗБЕКИСТАНА\n\n" + selected.map(rate => rate.Ccy + " — " + Number(rate.Rate).toLocaleString("ru-RU") + " сум (за " + rate.Nominal + ")").join("\n") + "\n\nДата курса: " + date + "\nИсточник: Центральный банк Узбекистана · cbu.uz";
  let text = "🧪 TEST XABAR · O‘ZBEKISTON MARKAZIY BANKI KURSLARI\n\n" + selected.map(rate => rate.Ccy + " — " + Number(rate.Rate).toLocaleString("uz-UZ") + " so‘m ( " + rate.Nominal + " birlik uchun)").join("\n") + "\n\nKurs sanasi: " + date + "\nManba: O‘zbekiston Markaziy banki · cbu.uz";
  if (language === "uz-cyrl") text = cyrillic(text);
  return text;
}

export async function GET(request: Request) {
  if (!await isNewsCronOrAdminAuthorized(request)) return NextResponse.json({ error: "Ruxsat yo‘q." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase sozlamasi topilmadi." }, { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("news_telegram_subscriptions")
    .select("chat_id,chat_type,language,categories").eq("enabled", true).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const recipients = (data || []).map(row => ({
    chatId: String(row.chat_id), type: String(row.chat_type || "private"),
    language: String(row.language || "uz-latn")
  }));
  const channel = process.env.NEWS_TELEGRAM_CHAT_ID;
  if (channel && !recipients.some(row => row.chatId === channel)) recipients.push({
    chatId: channel, type: "channel", language: process.env.NEWS_TELEGRAM_CHANNEL_LANGUAGE || "uz-latn"
  });
  return NextResponse.json({ ok: true, recipients });
}

export async function POST(request: Request) {
  if (!await isNewsCronOrAdminAuthorized(request)) return NextResponse.json({ error: "Ruxsat yo‘q." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY, token = process.env.TELEGRAM_BOT_TOKEN;
  if (!url || !key || !token) return NextResponse.json({ error: "Supabase yoki Telegram sozlamasi topilmadi." }, { status: 500 });
  const body = await request.json().catch(() => ({})) as { type?: TestType; chatId?: string };
  const type = body.type, chatId = String(body.chatId || "").trim();
  if (!type || !["motivation", "weather", "currency", "news"].includes(type)) return NextResponse.json({ error: "Test turi noto‘g‘ri." }, { status: 400 });
  if (!chatId || chatId.length > 100) return NextResponse.json({ error: "Telegram chat tanlanmagan." }, { status: 400 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const recipient = await getRecipient(db, chatId, process.env.NEWS_TELEGRAM_CHAT_ID);
  if (!recipient) return NextResponse.json({ error: "Bu chat faol obunachilar ro‘yxatida yo‘q." }, { status: 403 });
  const language = recipient.language || "uz-latn";
  try {
    let message = "";
    let details: Record<string, unknown> = {};
    if (type === "motivation") message = motivationMessage(language);
    if (type === "weather") {
      const { data: settings, error } = await db.from("news_daily_settings").select("city,latitude,longitude").eq("id", true).maybeSingle();
      if (error) throw new Error("Ob-havo sozlamasini o‘qib bo‘lmadi: " + error.message);
      const city = String(settings?.city || "Tashkent");
      const latitude = Number(settings?.latitude ?? 41.2995), longitude = Number(settings?.longitude ?? 69.2401);
      message = await buildWeatherMessage(city, latitude, longitude, language);
      details = { city, provider: "Open-Meteo" };
    }
    if (type === "currency") {
      message = await buildCurrencyMessage(language);
      details = { provider: "Central Bank of Uzbekistan", url: "https://cbu.uz/uz/arkhiv-kursov-valyut/json/" };
    }
    if (type === "news") {
      const { data: article, error } = await db.from("news_articles")
        .select("id,title,summary,source_name,source_url,category,editorial_score")
        .eq("status", "published").order("published_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error("Yangilikni olishda xatolik: " + error.message);
      if (!article) throw new Error("Test uchun nashr qilingan yangilik topilmadi.");
      const { data: translation, error: translationError } = await db.from("news_translations")
        .select("title,summary").eq("article_id", article.id).eq("language", language).maybeSingle();
      if (translationError) throw new Error("Yangilik tarjimasini olishda xatolik: " + translationError.message);
      const title = translation?.title || article.title;
      const summary = translation?.summary || article.summary || "";
      const displayTitle = language === "uz-cyrl" ? cyrillic(title) : title;
      const displaySummary = language === "uz-cyrl" ? cyrillic(summary) : summary;
      message = "🧪 TEST XABAR · AI NEWS\n\n" + displayTitle + "\n\n" + displaySummary + "\n\nManba: " + article.source_name + "\n" + article.source_url;
      details = { articleId: article.id, editorialScore: article.editorial_score ?? null, language };
    }
    const messageId = await sendTelegram(token, chatId, message);
    return NextResponse.json({ ok: true, type, chatId, language, messageId, details, note: "Faqat tanlangan chatga test yuborildi. Kundalik jadval va delivery yozuvlari o‘zgartirilmadi." });
  } catch (error) {
    return NextResponse.json({ ok: false, type, chatId, error: error instanceof Error ? error.message : "Test xabar yuborilmadi." }, { status: 502 });
  }
}
