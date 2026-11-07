import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;

type Translation = { title: string; summary: string };
type EditorialResult = { publish: boolean; reason?: string; uz_latn: Translation; uz_cyrl: Translation; ru: Translation };
type Article = { id: string; title: string; summary: string | null; source_name: string; source_url: string; image_url: string | null; video_url: string | null; category: string; status: string; processing_attempts: number; processing_started_at: string | null };
type ArticleContext = { description: string; body: string };
const topicRules: Record<string,{parents:string[];terms:string[]}> = {
 "O‘zbekiston qonunchiligi":{parents:["O‘zbekiston"],terms:["qonun","qonunchilik","kodeks","qaror","farmon","normativ"]},
 "Xalqaro huquq":{parents:["Jahon"],terms:["xalqaro huquq","xalqaro sud","human rights","international law"]},
 "Sud va huquqiy amaliyot":{parents:["O‘zbekiston","Jahon"],terms:["sud","sudya","sudlov","prokuror","advokat"]},
 "Normativ hujjatlar":{parents:["O‘zbekiston"],terms:["qaror","farmon","nizom","normativ","hujjat"]},
 "Fizika":{parents:["Fan"],terms:["fizika","physics","kvant","energiya"]},
 "Kimyo":{parents:["Fan"],terms:["kimyo","chemical","molekula","reaksiya"]},
 "Matematika":{parents:["Fan"],terms:["matematika","matematik","math","formula","polinom"]},
 "Biologiya":{parents:["Fan"],terms:["biologiya","biologik","hujayra","gen","organizm"]},
 "Astronomiya":{parents:["Fan"],terms:["astronomiya","kosmos","sayyora","yulduz","teleskop"]},
 "Geologiya":{parents:["Fan"],terms:["geologiya","yer qobig‘i","mineral","vulqon"]},
 "Ekologiya":{parents:["Fan"],terms:["ekologiya","iqlim","atrof-muhit","o‘rmon","ifloslanish"]},
 "Sun’iy intellekt":{parents:["AI va IT"],terms:["sun’iy intellekt","artificial intelligence","ai model","gpt","gemini","machine learning"]},
 "Dasturlash":{parents:["AI va IT"],terms:["dasturlash","programming","software","developer","kod"]},
 "Kiberxavfsizlik":{parents:["AI va IT"],terms:["kiberxavfsizlik","cybersecurity","hacker","ma’lumotlar sizishi"]},
 "Robototexnika":{parents:["AI va IT"],terms:["robot","robototexnika","robotics"]},
 "IT kompaniyalar":{parents:["AI va IT","Biznes"],terms:["tech company","texnologiya kompaniyasi","apple","google","microsoft","nvidia"]},
 "Startap texnologiyalari":{parents:["AI va IT","Biznes"],terms:["startap","startup","venture capital"]},
 "Davlat":{parents:["O‘zbekiston"],terms:["hukumat","vazir","prezident","davlat","hokim"]},
 "Jamiyat":{parents:["O‘zbekiston"],terms:["jamiyat","aholi","fuqaro","ijtimoiy"]},
 "Hududlar":{parents:["O‘zbekiston"],terms:["viloyat","tuman","shahar","hudud"]},
 "Ijtimoiy yangiliklar":{parents:["O‘zbekiston"],terms:["ijtimoiy","nafaqa","pensiya","bandlik"]},
 "Siyosat":{parents:["O‘zbekiston","Jahon"],terms:["siyosat","saylov","parlament","siyosiy"]},
 "Jahon yangiliklari":{parents:["Jahon"],terms:["xalqaro","dunyo","jahon"]},
 "Geosiyosat":{parents:["Jahon"],terms:["geosiyosat","geopolitical","sanksiya","diplomatiya"]},
 "Xalqaro munosabatlar":{parents:["Jahon"],terms:["xalqaro munosabat","elchi","sammit","tashqi ishlar"]},
 "Davlatlar":{parents:["Jahon"],terms:["davlat","mamlakat","country"]},
 "Jahon iqtisodiyoti":{parents:["Iqtisodiyot"],terms:["jahon iqtisodiyoti","global economy","iqtisodiyot"]},
 "Bozorlar":{parents:["Iqtisodiyot"],terms:["bozor","birja","aksiyalar","market"]},
 "Savdo":{parents:["Iqtisodiyot"],terms:["savdo","eksport","import","bojxona"]},
 "Sanoat":{parents:["Iqtisodiyot"],terms:["sanoat","zavod","ishlab chiqarish"]},
 "Makroiqtisodiyot":{parents:["Iqtisodiyot"],terms:["inflyatsiya","yalpi ichki mahsulot","foiz stavkasi","makroiqtisodiyot"]},
 "Bank":{parents:["Iqtisodiyot"],terms:["bank","markaziy bank"]},
 "Kredit":{parents:["Iqtisodiyot"],terms:["kredit","qarz","ipoteka"]},
 "Investitsiya":{parents:["Iqtisodiyot","Biznes"],terms:["investitsiya","investor","investment"]},
 "Soliq":{parents:["Iqtisodiyot"],terms:["soliq","soliqchi","tax"]},
 "Sug‘urta":{parents:["Iqtisodiyot"],terms:["sug‘urta","insurance"]},
 "Fintech":{parents:["Iqtisodiyot","AI va IT"],terms:["fintech","raqamli to‘lov","to‘lov tizimi"]},
 "Qurilish texnologiyalari":{parents:["Iqtisodiyot"],terms:["qurilish","bino","inshoot"]},
 "Kadastr":{parents:["O‘zbekiston","Iqtisodiyot"],terms:["kadastr","yer uchastkasi"]},
 "Qurilish materiallari":{parents:["Iqtisodiyot"],terms:["sement","beton","qurilish materiali"]},
 "Me’yorlar":{parents:["O‘zbekiston"],terms:["qurilish me’yori","standart","qurilish qoidasi"]},
 "Uy-joy bozori":{parents:["Iqtisodiyot"],terms:["uy-joy","ko‘chmas mulk","kvartira"]},
 "Ijara":{parents:["Iqtisodiyot"],terms:["ijara","rent"]},
 "Ipoteka":{parents:["Iqtisodiyot"],terms:["ipoteka","mortgage"]},
 "Arxitektura":{parents:["Iqtisodiyot"],terms:["arxitektura","me’morchilik"]},
 "Mebel":{parents:["Iqtisodiyot"],terms:["mebel","furniture"]},
 "Interyer":{parents:["Iqtisodiyot"],terms:["interyer","interior"]},
 "Eksteryer":{parents:["Iqtisodiyot"],terms:["eksteryer","exterior"]},
 "Dizayn materiallari":{parents:["Iqtisodiyot"],terms:["dizayn","design material"]},
 "Avtomobil":{parents:["Iqtisodiyot"],terms:["avtomobil","mashina","car","auto"]},
 "Maishiy texnika":{parents:["Iqtisodiyot"],terms:["maishiy texnika","kir yuvish","muzlatkich"]},
 "Ishlab chiqarish":{parents:["Iqtisodiyot"],terms:["ishlab chiqarish","manufacturing"]},
 "Transport":{parents:["Iqtisodiyot"],terms:["transport","temir yo‘l","aviatsiya"]},
 "Ta’lim texnologiyalari":{parents:["Fan"],terms:["edtech","ta’lim texnologiyasi","onlayn ta’lim"]},
 "Yangi metodlar":{parents:["Fan"],terms:["ta’lim metodi","pedagogika","o‘qitish usuli"]},
 "Ilmiy tadqiqotlar":{parents:["Fan"],terms:["tadqiqot","research","ilmiy ish","study"]},
 "Oliy ta’lim":{parents:["Fan","O‘zbekiston"],terms:["universitet","oliy ta’lim","talaba"]},
 "Tarix":{parents:["Jahon","O‘zbekiston"],terms:["tarix","history"]},
 "Kitoblar":{parents:["Jahon"],terms:["kitob","book","adabiyot"]},
 "Kino":{parents:["Jahon"],terms:["kino","film","movie"]},
 "San’at":{parents:["Jahon"],terms:["san’at","art","muzey"]},
 "Hajviya":{parents:["Jahon"],terms:["hajviya","satira","komediya"]},
 "Trendlar":{parents:["Jahon","AI va IT"],terms:["trend","viral","trendlar"]},
 "Qiziqarli faktlar":{parents:["Fan","Jahon"],terms:["qiziqarli fakt","interesting fact"]},
 "Fantastika":{parents:["Jahon"],terms:["fantastika","fantasy","science fiction"]},
 "Tadbirkorlik":{parents:["Biznes"],terms:["tadbirkor","entrepreneur","biznes"]},
 "Marketing":{parents:["Biznes"],terms:["marketing","reklama","brend"]},
 "Menejment":{parents:["Biznes"],terms:["menejment","boshqaruv","management"]},
 "Biznes yangiliklari":{parents:["Biznes"],terms:["kompaniya","biznes","korxona"]},
 "Tibbiyot":{parents:["Fan"],terms:["tibbiyot","tibbiy","medical","kasallik"]},
 "Ilmiy izlanishlar":{parents:["Fan"],terms:["ilmiy izlanish","tadqiqot","research"]},
 "Sog‘lom turmush":{parents:["Fan"],terms:["sog‘lom turmush","salomatlik","nutrition","fitness"]}
};
const mainCategoryParents: Record<string, string[]> = {
  "Huquq": ["O‘zbekiston"],
  "Fan": ["Fan"],
  "AI va IT": ["AI va IT"],
  "O‘zbekiston": ["O‘zbekiston"],
  "Jahon": ["Jahon"],
  "Iqtisodiyot": ["Iqtisodiyot"],
  "Bank va moliya": ["Iqtisodiyot"],
  "Qurilish": ["Iqtisodiyot"],
  "Ko‘chmas mulk": ["Iqtisodiyot"],
  "Mebel va dizayn": ["Iqtisodiyot"],
  "Texnika": ["AI va IT"],
  "Ta’lim": ["Fan"],
  "Madaniyat": ["Jahon"],
  "Ko‘ngilochar": ["Jahon"],
  "Biznes": ["Biznes"],
  "Salomatlik": ["Fan"],
  "Sport": ["Sport"]
};
function parentCategories(selected: string[]) {
  return [...new Set(selected.flatMap(topic =>
    mainCategoryParents[topic] || topicRules[topic]?.parents || [topic]
  ))];
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
const categoryRequiredTerms: Record<string, string[]> = {
  "Biznes": ["business", "company", "companies", "corporate", "startup", "start-up", "entrepreneur", "ceo", "earnings", "revenue", "profit", "merger", "acquisition", "ipo", "shares", "stock", "investor", "investment", "retail", "market", "brand", "commerce", "trade", "industry", "manufacturer", "manufacturing", "bank", "financial", "economy", "economic", "sales", "workforce", "layoff", "funding", "venture capital", "businessman", "businesswoman", "tadbirkor", "kompaniya", "daromad", "foyda", "sarmoya", "investitsiya", "savdo", "korxona"],
  "Iqtisodiyot": ["economy", "economic", "inflation", "gdp", "interest rate", "central bank", "currency", "exchange rate", "budget", "tax", "trade deficit", "exports", "imports", "unemployment", "jobs report", "wages", "debt", "fiscal", "monetary", "price index", "economist", "iqtisodiyot", "inflyatsiya", "yalpi ichki mahsulot", "markaziy bank", "valyuta", "byudjet", "soliq", "eksport", "import"],
  "AI va IT": ["artificial intelligence", " ai ", "machine learning", "software", "technology", "tech", "cybersecurity", "cyber security", "data breach", "hacker", "semiconductor", "chip", "cloud computing", "robotics", "app", "application", "smartphone", "computer", "internet", "algorithm", "model", "open source", "sun’iy intellekt", "dasturiy ta’minot", "texnologiya", "kiberxavfsizlik"]
};
function matchesTopics(article: Article, selected: string[]) {
  if (!selected.length || !parentCategories(selected).includes(article.category)) return false;
  const text = (" " + article.title + " " + (article.summary || "") + " ").toLocaleLowerCase();
  if ((categoryExclusions[article.category] || []).some(term => text.includes(term))) return false;
  // Broad source labels are not proof of article relevance. Require topical evidence
  // for business/economy/technology even when the parent category is selected.
  const required = categoryRequiredTerms[article.category];
  if (required && !required.some(term => text.includes(term))) return false;
  const specific = selected.filter(topic => topicTerms[topic]);
  const direct = selected.some(topic => broadTopics.has(topic) && mainCategoryParents[topic]?.includes(article.category));
  if (!direct && specific.length && !specific.some(topic => topicTerms[topic].some(term => text.includes(term)))) return false;
  if (!direct && !specific.length) return false;
  return true;
}

type DeliveryArticle = Pick<Article, "id" | "title" | "summary" | "source_name" | "source_url" | "image_url" | "video_url">;
async function sendNewsDelivery(
  db: ReturnType<typeof createClient>,
  token: string,
  article: DeliveryArticle,
  chatId: string,
  deliveryType: "private" | "channel",
  language: string,
  translation: Translation
) {
  const { data: existing } = await db.from("news_deliveries")
    .select("id,status,attempts,next_attempt_at")
    .eq("article_id", article.id).eq("chat_id", chatId).eq("delivery_type", deliveryType).maybeSingle();
  if (existing?.status === "sent") return { sent: false, skipped: true };
  if (existing && new Date(existing.next_attempt_at).getTime() > Date.now()) return { sent: false, skipped: true };
  const attempts = Number(existing?.attempts || 0) + 1;
  const { error: queueError } = await db.from("news_deliveries").upsert({
    article_id: article.id, chat_id: chatId, delivery_type: deliveryType, language,
    status: "sending", attempts, next_attempt_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: "article_id,chat_id,delivery_type" });
  if (queueError) return { sent: false, error: queueError.message };
  const buttons = [
    [{ text: "🔗 To‘liq yangilik", url: article.source_url }],
    ...(article.video_url ? [[{ text: "▶️ Videoni ko‘rish", url: article.video_url }]] : []),
    [{ text: "📰 IJOD AI News’da ochish", url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ijod-ai.vercel.app") + "/news" }]
  ];
  const caption = ("📰 " + translation.title + "\n\n" + translation.summary + "\n\nManba: " + article.source_name).slice(0, 1000);
  const method = article.image_url ? "sendPhoto" : "sendMessage";
  const payload = article.image_url
    ? { chat_id: chatId, photo: article.image_url, caption, reply_markup: { inline_keyboard: buttons } }
    : { chat_id: chatId, text: caption, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false };
  try {
    const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok) {
      await db.from("news_deliveries").update({
        status: "sent", telegram_message_id: String(result.result?.message_id || ""),
        sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString()
      }).eq("article_id", article.id).eq("chat_id", chatId).eq("delivery_type", deliveryType);
      return { sent: true };
    }
    const error = String(result.description || "Telegram HTTP " + response.status).slice(0, 500);
    const permanent = /bot was blocked|chat not found|not enough rights|bot is not a member|user is deactivated/i.test(error);
    const delayMinutes = Math.min(360, 5 * Math.pow(2, Math.min(attempts - 1, 6)));
    await db.from("news_deliveries").update({
      status: permanent || attempts >= 5 ? "failed" : "retry",
      next_attempt_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
      last_error: error, updated_at: new Date().toISOString()
    }).eq("article_id", article.id).eq("chat_id", chatId).eq("delivery_type", deliveryType);
    return { sent: false, error };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram delivery failed";
    const delayMinutes = Math.min(360, 5 * Math.pow(2, Math.min(attempts - 1, 6)));
    await db.from("news_deliveries").update({
      status: attempts >= 5 ? "failed" : "retry",
      next_attempt_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
      last_error: message.slice(0, 500), updated_at: new Date().toISOString()
    }).eq("article_id", article.id).eq("chat_id", chatId).eq("delivery_type", deliveryType);
    return { sent: false, error: message };
  }
}

async function fetchArticleContext(articleUrl: string): Promise<ArticleContext> {
  try {
    const response = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IJODAI-NewsBot/1.0)", "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow", signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) return { description: "", body: "" };
    const html = (await response.text()).slice(0, 500000);
    const meta = html.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]*content=["']([^"']+)["'][^>]*>/i)
      || html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]*>/i);
    const description = (meta?.[1] || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
    const articleHtml = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
    const body = articleHtml.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim().slice(0, 7000);
    return { description, body };
  } catch { return { description: "", body: "" }; }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const validSecrets = [process.env.NEWS_CRON_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
  if (!validSecrets.some(secret => authHeader === "Bearer " + secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!url || !key || !openaiKey)
    return NextResponse.json({ error: "Server config missing: Supabase yoki OpenAI kaliti." }, { status: 500 });

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: subscribers } = await db.from("news_telegram_subscriptions")
    .select("chat_id,language,categories").eq("enabled", true);
  const chats = (subscribers || []).map((s: { chat_id: string; language?: string | null; categories?: string[] | null }) => ({
    chatId: String(s.chat_id), language: String(s.language || "uz-latn"),
    categories: Array.isArray(s.categories) ? s.categories : []
  }));
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelChatId = process.env.NEWS_TELEGRAM_CHAT_ID || "";
  const channelLanguage = process.env.NEWS_TELEGRAM_CHANNEL_LANGUAGE || "uz-latn";
  const channelCategories = [...new Set(chats.flatMap(chat => chat.categories))];
  const channelRecipient = channelChatId ? {
    chatId: channelChatId, language: channelLanguage, categories: channelCategories, isChannel: true
  } : null;

  // Retry previously failed Telegram deliveries independently from translation.
  let deliveryRetriesProcessed = 0;
  if (botToken) {
    const { data: dueDeliveries } = await db.from("news_deliveries")
      .select("article_id,chat_id,delivery_type,language")
      .in("status", ["queued", "retry"]).lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true }).limit(5);
    for (const delivery of dueDeliveries || []) {
      const { data: article } = await db.from("news_articles")
        .select("id,title,summary,source_name,source_url,image_url,video_url")
        .eq("id", delivery.article_id).maybeSingle();
      if (!article) continue;
      if (delivery.delivery_type === "private") {
        const { data: subscriber } = await db.from("news_telegram_subscriptions")
          .select("enabled,categories").eq("chat_id", delivery.chat_id).maybeSingle();
        if (!subscriber?.enabled || !chats.some(chat => chat.chatId === delivery.chat_id && matchesTopics({ ...article, category: (article as any).category || "" } as Article, chat.categories))) continue;
      }
      const { data: translation } = await db.from("news_translations")
        .select("title,summary").eq("article_id", delivery.article_id).eq("language", delivery.language).maybeSingle();
      if (!translation) continue;
      await sendNewsDelivery(db, botToken, article as DeliveryArticle, delivery.chat_id,
        delivery.delivery_type as "private" | "channel", delivery.language,
        { title: translation.title, summary: translation.summary || "" });
      deliveryRetriesProcessed++;
    }
  }

  // Select news for subscriber interests first. A global LIMIT(5) used to let
  // unrelated categories fill the queue, so private subscribers received only
  // one matching story while the public channel received the whole batch.
  const interestedCategories = [...new Set(chats.flatMap(chat => parentCategories(chat.categories)))];
  if (!interestedCategories.length) return NextResponse.json({ ok: true, processed: 0, message: "Faol obunachilar hali mavzu tanlamagan." });
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: candidates, error } = await db.from("news_articles")
    .select("id,title,summary,source_name,source_url,image_url,video_url,category,status,processing_attempts,processing_started_at")
    .eq("status", "pending_translation").in("category", interestedCategories)
    .lte("processing_next_attempt_at", nowIso)
    .or("processing_started_at.is.null,processing_started_at.lt." + staleBefore)
    .order("published_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const articles = (candidates || []) as Article[];
  const eligible = articles.filter(article => chats.some(chat => matchesTopics(article, chat.categories)));
  const irrelevant = articles.filter(article => !chats.some(chat => matchesTopics(article, chat.categories)));
  if (irrelevant.length) await db.from("news_articles")
    .update({ status: "draft", processing_started_at: null, ai_analysis: "Avtomatik mavzu filtri: faol Telegram obunachilarining tanloviga mos kelmadi." })
    .in("id", irrelevant.map(article => article.id));
  const selectedArticles = eligible.slice(0, 1);
  if (!selectedArticles.length) {
    return NextResponse.json({ ok: true, processed: 0, skippedIrrelevant: irrelevant.length, pendingMatched: 0, message: "Tanlangan mavzularga mos, qayta ishlashga tayyor maqola topilmadi." });
  }

  const model = process.env.IJOD_NEWS_TRANSLATION_MODEL || process.env.IJOD_NEWS_MODEL || "gpt-6-luna";
  const outcomes: Array<{ id: string; translated: boolean; telegramSent: number; channelMessagesSent?: number; error?: string }> = [];

  for (const raw of selectedArticles) {
    const claimTime = new Date().toISOString();
    const claimStaleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: claim } = await db.from("news_articles")
      .update({ processing_started_at: claimTime })
      .eq("id", raw.id).eq("status", "pending_translation")
      .or("processing_started_at.is.null,processing_started_at.lt." + claimStaleBefore)
      .select("id").maybeSingle();
    if (!claim) continue;
    try {
      const cleanTitle = raw.title.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const titleWords = cleanTitle.split(/\s+/).filter(Boolean);
      const meaningfulWords = titleWords.filter(word => !/^\d+$/.test(word));
      let description = (raw.summary || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      let articleBody = "";
      if (description.length < 220) {
        const extra = await fetchArticleContext(raw.source_url);
        if (extra.description) description = [description, extra.description].filter(Boolean).join(" ");
        articleBody = extra.body;
      }
      if (meaningfulWords.length < 2 ||
          /^(?:[A-Z]{2,6}\s*\(?[A-Z]{1,4}\)?\s*\d{1,4}|untitled|no title|news update)$/i.test(raw.title.trim())) {
        await db.from("news_articles").update({ status: "draft", processing_started_at: null, processing_last_error: "Sarlavha yoki mazmun yetarlicha aniq emas." }).eq("id", raw.id);
        outcomes.push({ id: raw.id, translated: false, telegramSent: 0, error: "Sarlavha yoki mazmun yetarlicha aniq emas — nashrdan chiqarildi." });
        continue;
      }
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
            instructions: "You are IJOD AI News editor and strict quality gate. Reject fragments, codes/identifiers, incomplete RSS titles, vague headlines, empty context, malformed snippets, or stories that do not explain who did what. Never guess missing context. If not useful, return publish:false and a short reason. If useful, return publish:true and translate faithfully into Uzbek Latin, Uzbek Cyrillic and Russian. Each version needs a clear specific headline and factual 2-3 sentence summary. Preserve names, dates, numbers and uncertainty. Return valid json with publish, reason, uz_latn, uz_cyrl, ru; each translation has title and summary.",
            input: "Evaluate quality using all supplied source material. RSS snippets can be short; do not reject only because they are short. Use the original-page description/body if supplied. Reject only if the headline and available article context are genuinely unrelated, vague, fragmentary, or do not establish a concrete event/finding. Do not invent missing facts. Return JSON with publish, reason, uz_latn, uz_cyrl and ru. " + JSON.stringify({ source: raw.source_name, title: raw.title, rss_summary: raw.summary || "", original_page_description: description, original_article_text: articleBody }),
            text: { format: { type: "json_object" } },
            max_output_tokens: 1800
          }),
          signal: AbortSignal.timeout(18000)
        });
        if (!ai.ok) throw new Error("GPT API: " + (await ai.text()).slice(0, 400));
        const result = await ai.json();
        const output = (result.output || []).flatMap((item: { content?: Array<{ type?: string; text?: string }> } | null | undefined) => item?.content || [])
          .filter((part: { type?: string }) => part.type === "output_text")
          .map((part: { text?: string }) => part.text || "").join(" ").trim();
        const parsed = JSON.parse(output) as EditorialResult;
        if (parsed.publish !== true) {
          await db.from("news_articles").update({ status: "draft", processing_started_at: null, processing_last_error: String(parsed.reason || "Tahrir filtri rad etdi.").slice(0, 500) }).eq("id", raw.id);
          outcomes.push({ id: raw.id, translated: false, telegramSent: 0, error: "Tahrir filtri: " + String(parsed.reason || "yangilik aniq va tushunarli emas").slice(0, 180) });
          continue;
        }
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

      const { error: publishError } = await db.from("news_articles").update({ status: "published", processing_started_at: null, processing_attempts: 0, processing_next_attempt_at: new Date().toISOString(), processing_last_error: null }).eq("id", raw.id);
      if (publishError) throw new Error("Maqolani nashr qilish: " + publishError.message);

      let telegramSent = 0;
      let channelMessagesSent = 0;
      if (botToken) {
        const buttons = [[{ text: "🔗 To‘liq yangilik", url: raw.source_url }],
          ...(raw.video_url ? [[{ text: "▶️ Videoni ko‘rish", url: raw.video_url }]] : []),
          [{ text: "📰 IJOD AI News’da ochish", url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ijod-ai.vercel.app") + "/news" }]];
        const privateRecipients = chats.filter(chat => matchesTopics(raw, chat.categories));
        const recipients = [
          ...privateRecipients.map(chat => ({ ...chat, isChannel: false })),
          ...(channelRecipient && matchesTopics(raw, channelRecipient.categories) &&
            !privateRecipients.some(chat => chat.chatId === channelRecipient.chatId) ? [channelRecipient] : [])
        ];
        const deliveries = await Promise.all(recipients.map(async chat => {
          const item = variants.get(chat.language) || variants.get("uz-latn") || { title: raw.title, summary: raw.summary || "" };
          const result = await sendNewsDelivery(db, botToken, raw, chat.chatId,
            chat.isChannel ? "channel" : "private", chat.language, item);
          return { sent: result.sent ? 1 : 0, channel: Boolean(chat.isChannel) };
        }));
        telegramSent += deliveries.reduce<number>((sum, item) => sum + item.sent, 0);
        channelMessagesSent += deliveries.reduce<number>((sum, item) => sum + (item.channel ? item.sent : 0), 0);
      }
      if (telegramSent > 0) await db.from("news_articles")
        .update({ telegram_sent_at: new Date().toISOString() }).eq("id", raw.id);
      outcomes.push({ id: raw.id, translated: true, telegramSent, channelMessagesSent });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Processing failed";
      console.error("News processing failed", raw.id, message);
      const attempts = Number(raw.processing_attempts || 0) + 1;
      const delayMinutes = Math.min(360, 5 * Math.pow(2, Math.min(attempts - 1, 6)));
      await db.from("news_articles").update({
        processing_attempts: attempts,
        processing_next_attempt_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
        processing_last_error: message.slice(0, 1000),
        processing_started_at: null
      }).eq("id", raw.id);
      outcomes.push({ id: raw.id, translated: false, telegramSent: 0, error: message });
    }
  }

  return NextResponse.json({
    ok: outcomes.every(x => x.translated), phase: "translate_and_deliver",
    model, processed: outcomes.length, batchLimit: 1, deliveryRetriesProcessed, pendingMatched: eligible.length, skippedIrrelevant: irrelevant.length, translated: outcomes.filter(x => x.translated).length,
    telegramMessagesSent: outcomes.reduce((sum, x) => sum + x.telegramSent, 0),
    channelConfigured: Boolean(channelChatId),
    channelMessagesSent: outcomes.reduce((sum, x) => sum + Number(x.channelMessagesSent || 0), 0), outcomes
  });
}
