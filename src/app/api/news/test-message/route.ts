import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isNewsCronOrAdminAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 20;

type TestType = "motivation" | "weather" | "currency" | "news";
type Recipient = { chat_id: string; chat_type: string; language: string; categories: string[] };

const parentCategoryByPreference: Record<string, string[]> = {
  "Huquq": ["O‘zbekiston"], "O‘zbekiston": ["O‘zbekiston"],
  "Fan": ["Fan"], "Ta’lim": ["Fan"], "Salomatlik": ["Fan"],
  "AI va IT": ["AI va IT"], "Texnika": ["AI va IT"],
  "Jahon": ["Jahon"], "Madaniyat": ["Jahon"], "Ko‘ngilochar": ["Jahon"],
  "Iqtisodiyot": ["Iqtisodiyot"], "Bank va moliya": ["Iqtisodiyot"],
  "Qurilish": ["Iqtisodiyot"], "Ko‘chmas mulk": ["Iqtisodiyot"],
  "Mebel va dizayn": ["Iqtisodiyot"], "Biznes": ["Biznes"], "Sport": ["Sport"]
};

function allowedArticleCategories(preferences: string[]) {
  return [...new Set(preferences.flatMap(topic => parentCategoryByPreference[topic] || [topic]))]
    .filter(Boolean);
}

function cyrillic(value: string) {
  const pairs: Array<[string, string]> = [["o‘","ў"],["g‘","ғ"],["sh","ш"],["ch","ч"],["yo","ё"],["yu","ю"],["ya","я"],["ng","нг"],["a","а"],["b","б"],["d","д"],["e","е"],["f","ф"],["g","г"],["h","ҳ"],["i","и"],["j","ж"],["k","к"],["l","л"],["m","м"],["n","н"],["o","о"],["p","п"],["q","қ"],["r","р"],["s","с"],["t","т"],["u","у"],["v","в"],["x","х"],["y","й"],["z","з"],["c","ц"]];
  let result = value;
  for (const [latin, cyr] of pairs) result = result.replace(new RegExp(latin, "gi"), match => match === match.toUpperCase() ? cyr.toUpperCase() : cyr);
  return result;
}

type TelegramKeyboard = { inline_keyboard: Array<Array<{ text: string; url: string }>> };

async function sendTelegram(token: string, chatId: string, message: string, replyMarkup?: TelegramKeyboard, disablePreview = true) {
  const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: disablePreview, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await response.json().catch(() => ({})) as { ok?: boolean; description?: string; result?: { message_id?: number } };
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram xabarni qabul qilmadi.");
  return result.result?.message_id ?? null;
}

async function sendTelegramWithPhoto(token: string, chatId: string, caption: string, photoUrl: string, replyMarkup?: TelegramKeyboard) {
  const response = await fetch("https://api.telegram.org/bot" + token + "/sendPhoto", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption.slice(0, 1024), ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await response.json().catch(() => ({})) as { ok?: boolean; description?: string; result?: { message_id?: number } };
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram rasmni qabul qilmadi.");
  return result.result?.message_id ?? null;
}

async function resolveNewsPhotoUrl(imageUrl: string | null, sourceUrl: string): Promise<string | null> {
  const candidates = [imageUrl, sourceUrl].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; IJODAINews/1.0)", accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
        redirect: "follow", signal: AbortSignal.timeout(9000)
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.startsWith("image/")) return response.url || candidate;
      if (!contentType.includes("text/html")) continue;
      const html = await response.text();
      const tags = html.match(/<meta\\b[^>]*>/gi) || [];
      for (const tag of tags) {
        const property = tag.match(/(?:property|name)=[\"'](?:og:image|twitter:image)[\"']/i);
        if (!property) continue;
        const raw = tag.match(/content=[\"']([^\"']+)[\"']/i)?.[1];
        if (!raw) continue;
        const image = new URL(raw.replace(/&amp;/g, "&"), response.url || candidate).toString();
        const imageResponse = await fetch(image, {
          method: "HEAD", headers: { "user-agent": "Mozilla/5.0", accept: "image/*" },
          redirect: "follow", signal: AbortSignal.timeout(7000)
        });
        if (imageResponse.ok && (imageResponse.headers.get("content-type") || "").startsWith("image/")) {
          return imageResponse.url || image;
        }
        // Some CDNs reject HEAD but accept GET; Telegram can fetch the public URL itself.
        if (image.startsWith("https://")) return image;
      }
    } catch {
      // Try the canonical article page if the stored image URL was malformed.
    }
  }
  return null;
}

function newsKeyboard(sourceUrl: string): TelegramKeyboard {
  const newsUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://ijod-ai.vercel.app").replace(/\\/$/, "") + "/news";
  return { inline_keyboard: [
    [{ text: "🔗 To‘liq yangilik", url: sourceUrl }],
    [{ text: "📰 IJOD AI News’da ochish", url: newsUrl }]
  ] };
}

function weatherPhotoUrl(code: number, time: string) {
  const hour = Number(time.slice(11, 13));
  const day = hour >= 6 && hour < 18;
  let icon = "01";
  if (code === 0) icon = "01";
  else if (code <= 2) icon = "02";
  else if (code === 3) icon = "04";
  else if (code <= 48) icon = "50";
  else if (code <= 67) icon = "10";
  else if (code <= 77) icon = "13";
  else if (code <= 82) icon = "09";
  else icon = "11";
  return "https://openweathermap.org/img/wn/" + icon + (day ? "d" : "n") + "@4x.png";
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
  let recipientCategories = Array.isArray(recipient.categories) ? recipient.categories : [];
  // A channel has no individual subscription row: test only categories explicitly
  // selected by active subscribers. Never treat an empty list as "all topics".
  if (recipient.chat_type === "channel") {
    const { data: activeSubscriptions, error: subscriptionsError } = await db.from("news_telegram_subscriptions")
      .select("categories").eq("enabled", true);
    if (subscriptionsError) throw new Error("Kanal mavzularini tekshirib bo‘lmadi: " + subscriptionsError.message);
    recipientCategories = [...new Set((activeSubscriptions || []).flatMap((row: { categories?: string[] | null }) => Array.isArray(row.categories) ? row.categories : []))];
  }
  const articleCategories = allowedArticleCategories(recipientCategories);
  const language = recipient.language || "uz-latn";
  try {
    let message = "";
    let photoUrl = "";
    let details: Record<string, unknown> = {};
    if (type === "motivation") {
      message = motivationMessage(language);
      photoUrl = "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1200&q=85";
      details = { imageProvider: "Unsplash", imageType: "sunrise" };
    }
    if (type === "weather") {
      const { data: settings, error } = await db.from("news_daily_settings").select("city,latitude,longitude").eq("id", true).maybeSingle();
      if (error) throw new Error("Ob-havo sozlamasini o‘qib bo‘lmadi: " + error.message);
      const city = String(settings?.city || "Tashkent");
      const latitude = Number(settings?.latitude ?? 41.2995), longitude = Number(settings?.longitude ?? 69.2401);
      message = await buildWeatherMessage(city, latitude, longitude, language);
      const weatherResponse = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + latitude + "&longitude=" + longitude + "&current=weather_code&timezone=Asia%2FTashkent", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (weatherResponse.ok) {
        const weatherData = await weatherResponse.json() as { current?: { weather_code?: number; time?: string } };
        if (typeof weatherData.current?.weather_code === "number") photoUrl = weatherPhotoUrl(weatherData.current.weather_code, weatherData.current.time || new Date().toISOString());
      }
      details = { city, provider: "Open-Meteo", imageProvider: photoUrl ? "OpenWeatherMap weather icons" : null };
    }
    if (type === "currency") {
      message = await buildCurrencyMessage(language);
      photoUrl = "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=85";
      details = { provider: "Central Bank of Uzbekistan", url: "https://cbu.uz/uz/arkhiv-kursov-valyut/json/", imageProvider: "Unsplash" };
    }
    if (type === "news") {
      if (!articleCategories.length) {
        throw new Error("Bu Telegram chatida mavzular tanlanmagan. Avval /topics orqali kamida bitta mavzuni tanlang.");
      }
      const { data: articles, error } = await db.from("news_articles")
        .select("id,title,summary,source_name,source_url,image_url,category,editorial_score,published_at")
        .eq("status", "published").in("category", articleCategories)
        .order("published_at", { ascending: false }).limit(50);
      if (error) throw new Error("Tanlangan mavzulardagi yangiliklarni olishda xatolik: " + error.message);
      if (!articles?.length) {
        throw new Error("Tanlangan mavzularda hali nashr qilingan yangilik yo‘q. Boshqa mavzudagi xabar yuborilmadi.");
      }
      // Pick the newest article that also has a translation for this recipient.
      let article: (typeof articles)[number] | null = null;
      let translation: { title: string; summary: string | null } | null = null;
      for (const candidate of articles) {
        const { data, error: translationError } = await db.from("news_translations")
          .select("title,summary").eq("article_id", candidate.id).eq("language", language).maybeSingle();
        if (translationError) throw new Error("Yangilik tarjimasini olishda xatolik: " + translationError.message);
        if (data?.title) { article = candidate; translation = data; break; }
      }
      if (!article) throw new Error("Tanlangan mavzulardagi yangiliklar uchun " + language + " tarjima hali tayyor emas. Noto‘g‘ri mavzudagi xabar yuborilmadi.");
      const title = translation?.title || article.title;
      const summary = translation?.summary || article.summary || "";
      const displayTitle = language === "uz-cyrl" ? cyrillic(title) : title;
      const displaySummary = language === "uz-cyrl" ? cyrillic(summary) : summary;
      message = "🧪 TEST XABAR · AI NEWS\n\n" + displayTitle + "\n\n" + displaySummary + "\n\nManba: " + article.source_name + "\n" + article.source_url;
      photoUrl = await resolveNewsPhotoUrl(article.image_url, article.source_url) || "";
      details = { articleId: article.id, category: article.category, selectedCategories: recipientCategories, matchedCategories: articleCategories, editorialScore: article.editorial_score ?? null, language, imageAvailable: Boolean(photoUrl), imageResolvedFrom: photoUrl ? (article.image_url || article.source_url) : null };
    }
    let messageId: number | null = null;
    let imageSent = false;
    let imageError: string | null = null;
    const keyboard = type === "news" && details && typeof details === "object" && "articleId" in details
      ? newsKeyboard(String((await db.from("news_articles").select("source_url").eq("id", String(details.articleId)).maybeSingle()).data?.source_url || "https://ijod-ai.vercel.app/news"))
      : undefined;
    if (photoUrl) {
      try {
        messageId = await sendTelegramWithPhoto(token, chatId, message, photoUrl, keyboard);
        imageSent = true;
        if (message.length > 900) {
          await sendTelegram(token, chatId, message.slice(900), undefined, true);
        }
      } catch (error) {
        imageError = error instanceof Error ? error.message : "Rasm yuborilmadi.";
      }
    }
    if (!imageSent) {
      // Preserve the two navigation buttons even when a publisher blocks its image.
      messageId = await sendTelegram(token, chatId, message, keyboard, type === "news" ? false : true);
    }
    return NextResponse.json({ ok: true, type, chatId, language, messageId, imageSent, imageError, details, note: "Faqat tanlangan chatga test yuborildi. Kundalik jadval va delivery yozuvlari o‘zgartirilmadi." });
  } catch (error) {
    return NextResponse.json({ ok: false, type, chatId, error: error instanceof Error ? error.message : "Test xabar yuborilmadi." }, { status: 502 });
  }
}
