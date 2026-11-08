import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function telegram(token: string, method: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!response.ok) console.error("Telegram API error", method, await response.text());
}
const topicGroups: Record<string,string[]> = {
  "Huquq":["O‘zbekiston qonunchiligi","Xalqaro huquq","Sud va huquqiy amaliyot","Normativ hujjatlar"],
  "Fan":["Fizika","Kimyo","Matematika","Biologiya","Astronomiya","Geologiya","Ekologiya"],
  "AI va IT":["Sun’iy intellekt","Dasturlash","Kiberxavfsizlik","Robototexnika","IT kompaniyalar","Startap texnologiyalari"],
  "O‘zbekiston":["Davlat","Jamiyat","Hududlar","Ijtimoiy yangiliklar","Siyosat"],
  "Jahon":["Jahon yangiliklari","Geosiyosat","Xalqaro munosabatlar","Davlatlar"],
  "Iqtisodiyot":["Jahon iqtisodiyoti","Bozorlar","Savdo","Sanoat","Makroiqtisodiyot"],
  "Bank va moliya":["Bank","Kredit","Investitsiya","Soliq","Sug‘urta","Fintech"],
  "Qurilish":["Qurilish texnologiyalari","Kadastr","Qurilish materiallari","Me’yorlar"],
  "Ko‘chmas mulk":["Uy-joy bozori","Ijara","Ipoteka","Arxitektura"],
  "Mebel va dizayn":["Mebel","Interyer","Eksteryer","Dizayn materiallari"],
  "Texnika":["Avtomobil","Maishiy texnika","Ishlab chiqarish","Transport"],
  "Ta’lim":["Ta’lim texnologiyalari","Yangi metodlar","Ilmiy tadqiqotlar","Oliy ta’lim"],
  "Madaniyat":["Tarix","Kitoblar","Kino","San’at"],
  "Ko‘ngilochar":["Hajviya","Trendlar","Qiziqarli faktlar","Fantastika"],
  "Biznes":["Tadbirkorlik","Marketing","Menejment","Biznes yangiliklari"],
  "Salomatlik":["Tibbiyot","Ilmiy izlanishlar","Sog‘lom turmush"]
};
const topicOptions = Object.entries(topicGroups).flatMap(([group, topics]) => topics.map(topic => ({group, topic})));
const categories = [...Object.keys(topicGroups), "Sport"];
const parentCategory: Record<string,string> = {
  "Huquq":"O‘zbekiston","Fan":"Fan","AI va IT":"AI va IT","O‘zbekiston":"O‘zbekiston","Jahon":"Jahon",
  "Iqtisodiyot":"Iqtisodiyot","Bank va moliya":"Iqtisodiyot","Qurilish":"Iqtisodiyot","Ko‘chmas mulk":"Iqtisodiyot",
  "Mebel va dizayn":"Iqtisodiyot","Texnika":"AI va IT","Ta’lim":"Fan","Madaniyat":"Jahon",
  "Ko‘ngilochar":"Jahon","Biznes":"Biznes","Salomatlik":"Fan","Sport":"Sport"
};
function selectedParentCategories(selected: string[]) {
  const parents = selected.map(value => topicOptions.find(x => x.topic === value)?.group || value)
    .map(group => parentCategory[group] || group);
  return [...new Set(parents)];
}
const categoryExclusions: Record<string, string[]> = {
  "Biznes": ["godzilla", "film critic", "best film", "movie", "movies", "cinema", "actor", "actress", "box office", "trailer", "tv show", "television series", "streaming series"],
  "Iqtisodiyot": ["godzilla", "film critic", "best film", "movie review", "cinema", "football", "basketball", "tennis match"],
  "AI va IT": ["godzilla", "film critic", "movie review", "football match", "basketball game"],
  "O‘zbekiston": ["godzilla", "film critic", "movie review"],
  "Jahon": ["godzilla", "film critic", "movie review"]
};
const topicTerms: Record<string, string[]> = {
  "Kiberxavfsizlik": ["cybersecurity", "cyber security", "hacker", "ransomware", "data breach", "malware", "vulnerability", "kiberxavfsizlik"],
  "Ko‘chmas mulk": ["real estate", "property market", "housing market", "mortgage", "rent", "apartment", "property prices", "ko‘chmas mulk", "ipoteka", "uy-joy bozori", "ijara"],
  "Texnika": ["technology", "tech", "device", "smartphone", "electronics", "automotive", "car", "maishiy texnika", "gadjet", "texnika"],
  "Bank va moliya": ["bank", "central bank", "interest rate", "loan", "credit", "finance", "fintech", "investment", "stock market", "soliq", "sug‘urta"],
  "Qurilish": ["construction", "building", "infrastructure", "cement", "concrete", "real estate development", "qurilish", "kadastr"],
  "Mebel va dizayn": ["furniture", "interior design", "exterior design", "architecture", "interyer", "mebel", "dizayn"],
  "Ta’lim": ["education", "university", "school", "student", "teaching", "higher education", "ta’lim", "universitet"],
  "Salomatlik": ["health", "medical", "medicine", "hospital", "disease", "healthcare", "tibbiyot", "salomatlik"],
  "Madaniyat": ["culture", "history", "book", "literature", "art", "museum", "tarix", "madaniyat", "san’at"],
  "Ko‘ngilochar": ["entertainment", "celebrity", "music", "film", "movie", "cinema", "tv show", "streaming", "ko‘ngilochar"],
  "Huquq": ["law", "legal", "court", "judge", "legislation", "regulation", "qonun", "sud", "huquq"],
  "Fan": ["science", "scientific", "research", "physics", "chemistry", "biology", "astronomy", "fan", "tadqiqot"],
  "Sport": ["sport", "football", "soccer", "basketball", "tennis", "boxing", "formula 1", "cricket", "athlete", "championship"]
};
const broadTopics = new Set(["O‘zbekiston", "Jahon", "AI va IT", "Iqtisodiyot", "Biznes"]);
function matchesSelectedArticle(article: {category: string; title: string; summary?: string | null}, selected: string[]) {
  if (!selected.length || !selectedParentCategories(selected).includes(article.category)) return false;
  const text = (article.title + " " + (article.summary || "")).toLocaleLowerCase();
  const exclusions = categoryExclusions[article.category] || [];
  if (exclusions.some(term => text.includes(term))) return false;
  const specific = selected.filter(topic => topicTerms[topic]);
  const selectedDirect = selected.some(topic => broadTopics.has(topic) && categories.includes(topic) && parentCategory[topic] === article.category);
  if (!selectedDirect && specific.length && !specific.some(topic => topicTerms[topic].some(term => text.includes(term)))) return false;
  if (!selectedDirect && !specific.length) return false;
  return true;
}
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
      rows[rows.length - 1].push({
        text: (selected.includes(category) ? "✅ " : "▫️ ") + category,
        callback_data: "news_group:" + index
      });
      return rows;
    }, []),
    [{ text: "✅ Tayyor / Готово", callback_data: "news_topics_done" }]
  ]};
}
export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret || request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (data.startsWith("news_vote:")) {
      const match = data.match(/^news_vote:([0-9a-f-]{36}):(-?1)$/i);
      const voterId = Number(callback.from?.id);
      if (!match || !Number.isSafeInteger(voterId) || voterId <= 0) {
        await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "Ovoz ma’lumoti noto‘g‘ri.", show_alert: true });
        return NextResponse.json({ ok: true });
      }
      const articleId = match[1];
      const vote = Number(match[2]);
      const { data: article, error: articleError } = await db.from("news_articles")
        .select("id").eq("id", articleId).eq("status", "published").maybeSingle();
      if (articleError || !article) {
        await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "Bu yangilik topilmadi yoki endi faol emas.", show_alert: true });
        return NextResponse.json({ ok: true });
      }
      const { error: voteError } = await db.from("news_article_feedback").upsert({
        article_id: articleId, telegram_user_id: voterId, chat_id: chatId,
        vote, updated_at: new Date().toISOString()
      }, { onConflict: "article_id,telegram_user_id" });
      await telegram(token, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: voteError ? "Ovozni saqlab bo‘lmadi. Keyinroq urinib ko‘ring." : (vote === 1 ? "Rahmat! 👍" : "Fikringiz uchun rahmat.")
      });
      if (voteError) console.error("News feedback save failed", voteError.message);
      return NextResponse.json({ ok: true, saved: !voteError });
    } else if (data.startsWith("news_lang:")) {
      const language = data.slice("news_lang:".length);
      if (!(language in languageNames)) return NextResponse.json({ ok: true });
      await db.from("news_telegram_subscriptions").upsert({ chat_id: chatId, chat_type: callback.message?.chat?.type || "private", username: callback.from?.username || null, language, categories: Array.isArray(subscription?.categories) ? subscription.categories as string[] : [], enabled: true, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
      const localized = copy[language];
      await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "OK" });
      await telegram(token, "sendMessage", { chat_id: chatId, text: localized.saved + "\n\n" + localized.about, reply_markup: aboutKeyboard });
      await telegram(token, "sendMessage", { chat_id: chatId, text: localized.topics, reply_markup: topicKeyboard([]) });
    } else if (data.startsWith("news_group:")) {
      const index = Number(data.slice("news_group:".length));
      const category = categories[index];
      if (!Number.isInteger(index) || !category) return NextResponse.json({ ok: true });
      const current = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [];
      const next = current.includes(category)
        ? current.filter(item => item !== category)
        : [...current, category];
      await db.from("news_telegram_subscriptions").update({ categories: next, updated_at: new Date().toISOString() }).eq("chat_id", chatId);
      await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: next.includes(category) ? "Tanlandi / Выбрано" : "Bekor qilindi / Отменено" });
      await telegram(token, "editMessageReplyMarkup", { chat_id: chatId, message_id: callback.message?.message_id, reply_markup: topicKeyboard(next) });
    } else if (data === "news_topics_back" || data.startsWith("news_topic:")) {
      // Redraw old open keyboards using the main-category-only selection.
      const selected = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [];
      await telegram(token, "answerCallbackQuery", { callback_query_id: callback.id, text: "Mavzular / Темы" });
      await telegram(token, "editMessageReplyMarkup", { chat_id: chatId, message_id: callback.message?.message_id, reply_markup: topicKeyboard(selected) });
    } else if (data === "news_topics_done") {
      const selected = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [];
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
    await db.from("news_telegram_subscriptions").upsert({ chat_id: chatId, chat_type: chat.type || "private", username: message.from?.username || null, categories: Array.isArray(subscription?.categories) ? subscription.categories as string[] : [], enabled: true, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.started + "\n\n" + messages.choose, reply_markup: languageKeyboard });
  } else if (text.startsWith("/about")) {
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.about, reply_markup: aboutKeyboard });
  } else if (text.startsWith("/help")) {
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.help });
  } else if (text.startsWith("/language")) {
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.choose, reply_markup: languageKeyboard });
  } else if (text.startsWith("/topics")) {
    const selected = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [];
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.topics, reply_markup: topicKeyboard(selected) });
  } else if (text.startsWith("/stop")) {
    await db.from("news_telegram_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("chat_id", chatId);
    await telegram(token, "sendMessage", { chat_id: chatId, text: messages.stopped });
  } else if (text.startsWith("/latest")) {
    const selected = Array.isArray(subscription?.categories) ? subscription.categories as string[] : [];
    const { data: latestCandidates } = selected.length ? await db.from("news_articles")
      .select("id,title,summary,source_name,source_url,image_url,video_url,category")
      .eq("status", "published").in("category", selectedParentCategories(selected))
      .order("published_at", { ascending: false }).limit(60) : { data: [] };
    const data = (latestCandidates || []).filter(article => matchesSelectedArticle(article, selected)).slice(0, 5);
    const ids = data.map(a => a.id);
    const { data: translations } = ids.length
      ? await db.from("news_translations").select("article_id,title,summary").eq("language", language).in("article_id", ids)
      : { data: [] };
    const translated = new Map((translations || []).map(t => [t.article_id, t]));
    if (!data.length) {
      await telegram(token, "sendMessage", { chat_id: chatId, text: messages.latestEmpty });
    } else {
      for (let index = 0; index < data.length; index++) {
        const article = data[index];
        const translation = translated.get(article.id);
        const title = translation?.title || article.title;
        const summary = translation?.summary || article.summary || "";
        const caption = (title + "\n\n" + summary + "\n\nManba: " + (article.source_name || "Manba")).slice(0, 1000);
        const buttons = [
          [{ text: "🔗 To‘liq yangilik", url: article.source_url }],
          ...(article.video_url ? [[{ text: "▶️ Videoni ko‘rish", url: article.video_url }]] : []),
          [{ text: "📰 IJOD AI News’da ochish", url: "https://ijod-ai.vercel.app/news" }]
        ];
        const directVideo = Boolean(article.video_url && /\.(mp4|m4v|mov|webm)(?:[?#]|$)/i.test(article.video_url));
        const method = directVideo ? "sendVideo" : article.image_url ? "sendPhoto" : "sendMessage";
        const payload = directVideo
          ? { chat_id: chatId, video: article.video_url, caption, reply_markup: { inline_keyboard: buttons } }
          : article.image_url
            ? { chat_id: chatId, photo: article.image_url, caption, reply_markup: { inline_keyboard: buttons } }
            : { chat_id: chatId, text: caption, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false };
        await telegram(token, method, payload);
        if (index < data.length - 1) await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }
  }
  return NextResponse.json({ ok: true });
}
