import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isNewsCronOrAdminAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 60;

type Translation = { title: string; summary: string };
type EditorialResult = { publish: boolean; reason?: string; quality?: { relevance?: number; usefulness?: number; source_reliability?: number; originality?: number; clarity?: number }; uz_latn: Translation; uz_cyrl: Translation; ru: Translation };
type Article = { id: string; title: string; summary: string | null; source_name: string; source_url: string; image_url: string | null; video_url: string | null; category: string; status: string; editorial_score?: number | null; published_at?: string | null };
type ArticleContext = { description: string; body: string; imageUrl: string | null };
type NewsChat = { chatId: string; language: string; categories: string[]; isChannel?: boolean };
type DeliveryRow = { chat_id: string; delivery_type: string; status: string; next_attempt_at: string | null };
type TranslationRow = { language: string; title: string; summary: string | null };
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
  const specific = selected.filter(topic => topicTerms[topic] || topicRules[topic]);
  const direct = selected.some(topic => broadTopics.has(topic) && mainCategoryParents[topic]?.includes(article.category));
  const matchesSpecific = specific.some(topic => (topicTerms[topic] || topicRules[topic]?.terms || []).some(term => text.includes(term)));
  const matchesBroad = direct && (!required || required.some(term => text.includes(term)));
  // A specific topic (construction, furniture, law, health, etc.) must not be
  // rejected by unrelated parent-category keywords such as economy terms.
  return matchesSpecific || matchesBroad;
}

async function retryPendingDeliveries(db: any, token: string) {
  const now = new Date().toISOString();
  const { data: due, error } = await db.from("news_deliveries")
    .select("id,article_id,chat_id,delivery_type,language,attempts")
    .in("status", ["queued", "retry"])
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) throw new Error("Delivery retry queue: " + error.message);
  let sent = 0, failed = 0;
  for (const item of due || []) {
    const attempts = Number(item.attempts || 0) + 1;
    const { data: claimedDelivery, error: claimError } = await db.from("news_deliveries")
      .update({ status: "sending", attempts, updated_at: now })
      .eq("id", item.id).in("status", ["queued", "retry"]).select("id").maybeSingle();
    if (claimError || !claimedDelivery) { if (claimError) failed++; continue; }
    const { data: article, error: articleError } = await db.from("news_articles")
      .select("id,title,summary,source_name,source_url,image_url,video_url")
      .eq("id", item.article_id).maybeSingle();
    if (articleError || !article) { await db.from("news_deliveries").update({ status: "failed", last_error: articleError?.message || "Maqola topilmadi.", updated_at: now }).eq("id", item.id); failed++; continue; }
    if (item.delivery_type === "private") {
      const { data: sub, error: subError } = await db.from("news_telegram_subscriptions")
        .select("enabled").eq("chat_id", item.chat_id).maybeSingle();
      if (subError || !sub?.enabled) {
        await db.from("news_deliveries").update({
          status: "failed", next_attempt_at: now,
          last_error: subError?.message || "Obunachi faol emas.", updated_at: now
        }).eq("article_id", item.article_id).eq("chat_id", item.chat_id).eq("delivery_type", item.delivery_type);
        failed++; continue;
      }
    }
    const { data: translation, error: translationError } = await db.from("news_translations")
      .select("title,summary").eq("article_id", item.article_id).eq("language", item.language).maybeSingle();
    if (translationError || !translation) { await db.from("news_deliveries").update({ status: "failed", last_error: translationError?.message || "Tarjima topilmadi.", updated_at: now }).eq("id", item.id); failed++; continue; }
    const buttons = [
      [{ text: "👍", callback_data: "news_vote:" + item.article_id + ":1" }, { text: "👎", callback_data: "news_vote:" + item.article_id + ":-1" }],
      ...(article.video_url ? [[{ text: "▶️ Videoni ko‘rish", url: article.video_url }]] : []),
      [{ text: "📰 IJOD AI News’da ochish", url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ijod-ai.vercel.app") + "/news" }]
    ];
    const caption = ("📰 " + translation.title + "\n\n" + (translation.summary || "") + "\n\nManba: " + article.source_name).slice(0, 1000);
    const send = async (method: string, payload: Record<string, unknown>) => {
      const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      const result = await response.json().catch(() => ({}));
      return { ok: response.ok && result.ok === true, result, status: response.status };
    };
    let outcome = article.image_url
      ? await send("sendPhoto", { chat_id: item.chat_id, photo: article.image_url, caption, reply_markup: { inline_keyboard: buttons } })
      : await send("sendMessage", { chat_id: item.chat_id, text: caption, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false });
    if (!outcome.ok && article.image_url && /failed to get HTTP URL content|wrong file identifier|failed to get|wrong type of the web page/i.test(String(outcome.result.description || ""))) {
      outcome = await send("sendMessage", { chat_id: item.chat_id, text: caption, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false });
    }
    const at = new Date().toISOString();
    if (outcome.ok) {
      const { error: saveError } = await db.from("news_deliveries").update({
        status: "sent", sent_at: at, telegram_message_id: String(outcome.result.result?.message_id || ""),
        next_attempt_at: at, last_error: null, updated_at: at
      }).eq("article_id", item.article_id).eq("chat_id", item.chat_id).eq("delivery_type", item.delivery_type);
      if (saveError) { failed++; continue; }
      sent++;
    } else {
      const reason = String(outcome.result.description || "Telegram HTTP " + outcome.status).slice(0, 500);
      const permanent = /bot was blocked|chat not found|not enough rights|bot is not a member|user is deactivated/i.test(reason);
      const delay = Math.min(360, 5 * Math.pow(2, Math.min(Math.max(0, attempts - 1), 6)));
      await db.from("news_deliveries").update({
        status: permanent || attempts >= 5 ? "failed" : "retry",
        next_attempt_at: new Date(Date.now() + delay * 60000).toISOString(),
        last_error: reason, updated_at: at
      }).eq("article_id", item.article_id).eq("chat_id", item.chat_id).eq("delivery_type", item.delivery_type);
      failed++;
    }
  }
  return { sent, failed, processed: (due || []).length };
}

async function fetchArticleContext(articleUrl: string): Promise<ArticleContext> {
  try {
    const response = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IJODAI-NewsBot/1.0)", "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow", signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return { description: "", body: "", imageUrl: null };
    const html = (await response.text()).slice(0, 500000);
    const getMeta = (keys: string[]) => {
      for (const key of keys) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\async function fetchArticleContext(articleUrl: string): Promise<ArticleContext> {
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
}");
        const match = html.match(new RegExp('<meta\\b(?=[^>]*(?:property|name)=["\\']' + escaped + '["\\'])[^>]*content=["\\']([^"\\']+)["\\'][^>]*>', "i"))
          || html.match(new RegExp('<meta\\b(?=[^>]*content=["\\']([^"\\']+)["\\'])[^>]*(?:property|name)=["\\']' + escaped + '["\\'][^>]*>', "i"));
        if (match?.[1]) return match[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
      }
      return "";
    };
    const description = getMeta(["og:description", "twitter:description", "description"]).trim();
    const rawImage = getMeta(["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
    let imageUrl: string | null = null;
    if (rawImage) {
      try {
        const resolved = new URL(rawImage, response.url || articleUrl);
        if (resolved.protocol === "https:" || resolved.protocol === "http:") imageUrl = resolved.toString();
      } catch { /* Ignore malformed source image URLs. */ }
    }
    const articleHtml = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
    const body = articleHtml.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim().slice(0, 7000);
    return { description, body, imageUrl };
  } catch { return { description: "", body: "", imageUrl: null }; }
}

export async function GET(request: Request) {
  if (!await isNewsCronOrAdminAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!url || !key || !openaiKey)
    return NextResponse.json({ error: "Server config missing: Supabase yoki OpenAI kaliti." }, { status: 500 });

  // News tables are managed through SQL migrations and are not yet included in the generated Database type.
  // Keep this server-only client dynamically typed until the schema types are regenerated.
  const db: any = createClient(url, key, { auth: { persistSession: false } });
  const { data: subscribers } = await db.from("news_telegram_subscriptions")
    .select("chat_id,language,categories").eq("enabled", true);
  const chats: NewsChat[] = (subscribers || []).map((s: { chat_id: string; language?: string | null; categories?: string[] | null }) => ({
    chatId: String(s.chat_id), language: String(s.language || "uz-latn"),
    categories: Array.isArray(s.categories) ? s.categories : []
  }));
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelChatId = process.env.NEWS_TELEGRAM_CHAT_ID || "";
  const channelLanguage = process.env.NEWS_TELEGRAM_CHANNEL_LANGUAGE || "uz-latn";
  const retrySummary = botToken ? await retryPendingDeliveries(db, botToken) : { sent: 0, failed: 0, processed: 0 };
  const channelCategories: string[] = [...new Set<string>(chats.flatMap((chat: NewsChat) => chat.categories))];
  const channelRecipient: NewsChat | null = channelChatId ? {
    chatId: channelChatId, language: channelLanguage, categories: channelCategories, isChannel: true
  } : null;

  // Select news for subscriber interests first. A global LIMIT(5) used to let
  // unrelated categories fill the queue, so private subscribers received only
  // one matching story while the public channel received the whole batch.
  const interestedCategories: string[] = [...new Set<string>(chats.flatMap((chat: NewsChat) => parentCategories(chat.categories)))];
  if (!interestedCategories.length) return NextResponse.json({ ok: true, processed: 0, message: "Faol obunachilar hali mavzu tanlamagan." });
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: candidates, error } = await db.from("news_articles")
    .select("id,title,summary,source_name,source_url,image_url,video_url,category,status,processing_attempts,processing_started_at,editorial_score,published_at")
    .eq("status", "pending_translation").in("category", interestedCategories)
    .is("telegram_sent_at", null)
    .or("processing_next_attempt_at.is.null,processing_next_attempt_at.lte." + nowIso)
    .or("processing_started_at.is.null,processing_started_at.lt." + staleBefore)
    // Do not let years-old Google News feed metadata starve current stories.
    // Only process recent articles and always prioritize the newest first.
    .gte("published_at", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
    .order("published_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const articles = (candidates || []) as Article[];
  const eligible = articles.filter(article => chats.some((chat: NewsChat) => matchesTopics(article, chat.categories)));
  if (!eligible.length) {
    return NextResponse.json({
      ok: true, processed: 0, candidatesChecked: articles.length,
      message: "Oxirgi 72 soatda tanlangan mavzularga mos yangi maqola topilmadi."
    });
  }
  // Process a small batch per request to avoid one article blocking the entire queue.
  const { data: roundRobinState } = await db.from("news_pipeline_state").select("last_processed_category").eq("id", true).maybeSingle();
  const lastCategory = String(roundRobinState?.last_processed_category || "");
  const articleIds = eligible.map(article => article.id);
  const { data: recentVotes } = articleIds.length
    ? await db.from("news_article_feedback").select("article_id,vote").in("article_id", articleIds).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
    : { data: [] };
  const communityScores = new Map<string, number>();
  for (const vote of recentVotes || []) communityScores.set(vote.article_id, (communityScores.get(vote.article_id) || 0) + Number(vote.vote));
  const selectedArticles = [...eligible].sort((a, b) => {
    const repeatA = a.category === lastCategory ? 1 : 0;
    const repeatB = b.category === lastCategory ? 1 : 0;
    const scoreA = Number(a.editorial_score || 0) + Math.max(-1, Math.min(1, (communityScores.get(a.id) || 0) * 0.15));
    const scoreB = Number(b.editorial_score || 0) + Math.max(-1, Math.min(1, (communityScores.get(b.id) || 0) * 0.15));
    return repeatA - repeatB || scoreB - scoreA || new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
  }).slice(0, 1);

  const model = process.env.IJOD_NEWS_TRANSLATION_MODEL || process.env.IJOD_NEWS_MODEL || "gpt-6-luna";
  const outcomes: Array<{ id: string; translated: boolean; telegramSent: number; channelMessagesSent?: number; editorialScore?: number | null; error?: string; deliveryErrors?: string[]; matchedRecipients?: number }> = [];

  for (const raw of selectedArticles) {
    // Atomic claim prevents overlapping cron/manual requests from delivering the same article twice.
    const claimTime = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: claimed, error: claimError } = await db.from("news_articles")
      .update({ processing_started_at: claimTime })
      .eq("id", raw.id)
      .eq("status", "pending_translation")
      .is("telegram_sent_at", null)
      .or("processing_started_at.is.null,processing_started_at.lt." + staleBefore)
      .select("id")
      .maybeSingle();
    if (claimError) {
      console.error("Could not claim news article", raw.id, claimError.message);
      continue;
    }
    if (!claimed) continue;
    let editorialScoreForOutcome: number | null = raw.editorial_score ?? null;
    await db.from("news_pipeline_state").update({ last_processed_category: raw.category, updated_at: new Date().toISOString() }).eq("id", true);
    try {
      const cleanTitle = raw.title.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const titleWords = cleanTitle.split(/\s+/).filter(Boolean);
      const meaningfulWords = titleWords.filter(word => !/^\d+$/.test(word));
      let description = (raw.summary || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      let articleBody = "";
      if (description.length < 220 || !raw.image_url) {
        const extra = await fetchArticleContext(raw.source_url);
        if (extra.description) description = [description, extra.description].filter(Boolean).join(" ");
        articleBody = extra.body;
        if (!raw.image_url && extra.imageUrl) {
          raw.image_url = extra.imageUrl;
          await db.from("news_articles").update({ image_url: extra.imageUrl }).eq("id", raw.id);
        }
      }
      if (meaningfulWords.length < 2 ||
          /^(?:[A-Z]{2,6}\s*\(?[A-Z]{1,4}\)?\s*\d{1,4}|untitled|no title|news update)$/i.test(raw.title.trim())) {
        await db.from("news_articles").update({ status: "draft" }).eq("id", raw.id);
        outcomes.push({ id: raw.id, translated: false, telegramSent: 0, error: "Sarlavha yoki mazmun yetarlicha aniq emas — nashrdan chiqarildi." });
        continue;
      }
      // First identify the actual audience before spending tokens on translation.
      const privateRecipients = chats.filter((chat: NewsChat) => matchesTopics(raw, chat.categories));
      const recipients = [
        ...privateRecipients.map((chat: NewsChat) => ({ ...chat, isChannel: false })),
        ...(channelRecipient && matchesTopics(raw, channelRecipient.categories) &&
          !privateRecipients.some((chat: NewsChat) => chat.chatId === channelRecipient.chatId) ? [channelRecipient] : [])
      ];
      // First identify the actual audience. Do not spend translation tokens for users
      // whose selected topics do not match this article.
      if (!recipients.length) {
        await db.from("news_articles").update({
          processing_started_at: null,
          processing_last_error: null
        }).eq("id", raw.id);
        outcomes.push({ id: raw.id, translated: false, telegramSent: 0, error: "Foydalanuvchilarga mos auditoriya topilmadi." });
        continue;
      }

      // Stage 1: editorial relevance and quality check only. Source text is never
      // translated before it passes this gate.
      const editorial = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + openaiKey },
        body: JSON.stringify({
          model,
          instructions: "You are IJOD AI News senior editor. Evaluate the source article for factual clarity, usefulness, reliability, relevance and originality. Do NOT translate or rewrite it. Reject fragments, codes/identifiers, incomplete RSS titles, vague headlines, empty context, malformed snippets, or stories that do not explain who did what. Never guess missing context. Return only JSON with publish, reason, and quality:{relevance,usefulness,source_reliability,originality,clarity}, each score an integer from 1 to 10. Publish only if weighted score is at least 6.",
          input: "Evaluate this original, untranslated source article for IJOD AI News readers. Return a valid JSON object only. Weighted score: relevance 25%, usefulness 25%, source reliability 20%, originality 15%, clarity 15%. Do not translate. Article context: " +
            JSON.stringify({ source: raw.source_name, title: raw.title, rss_summary: raw.summary || "", original_page_description: description, original_article_text: articleBody }),
          text: { format: { type: "json_object" } },
          max_output_tokens: 700
        }),
        signal: AbortSignal.timeout(18000)
      });
      if (!editorial.ok) throw new Error("GPT editorial API: " + (await editorial.text()).slice(0, 400));
      const editorialResult = await editorial.json();
      const editorialOutput = (editorialResult.output || []).flatMap((item: { content?: Array<{ type?: string; text?: string }> } | null | undefined) => item?.content || [])
        .filter((part: { type?: string }) => part.type === "output_text")
        .map((part: { text?: string }) => part.text || "").join(" ").trim();
      const parsed = JSON.parse(editorialOutput) as Pick<EditorialResult, "publish" | "reason" | "quality">;
      const quality = {
        relevance: Math.max(1, Math.min(10, Math.round(Number(parsed.quality?.relevance) || 1))),
        usefulness: Math.max(1, Math.min(10, Math.round(Number(parsed.quality?.usefulness) || 1))),
        source_reliability: Math.max(1, Math.min(10, Math.round(Number(parsed.quality?.source_reliability) || 1))),
        originality: Math.max(1, Math.min(10, Math.round(Number(parsed.quality?.originality) || 1))),
        clarity: Math.max(1, Math.min(10, Math.round(Number(parsed.quality?.clarity) || 1)))
      };
      const editorialScore = Math.round(quality.relevance * 0.25 + quality.usefulness * 0.25 + quality.source_reliability * 0.20 + quality.originality * 0.15 + quality.clarity * 0.15);
      editorialScoreForOutcome = editorialScore;
      const rejectReason = String(parsed.reason || "Sifat balli nashr chegarasidan past.").slice(0, 500);
      if (parsed.publish !== true || editorialScore < 6) {
        await db.from("news_articles").update({
          status: "draft", editorial_score: editorialScore, editorial_reason: rejectReason,
          editorial_quality: quality, processing_started_at: null, processing_last_error: rejectReason
        }).eq("id", raw.id);
        outcomes.push({ id: raw.id, translated: false, telegramSent: 0, editorialScore, error: "Tahrir filtri: " + rejectReason.slice(0, 180) });
        continue;
      }
      const { error: scoreSaveError } = await db.from("news_articles")
        .update({ editorial_score: editorialScore, editorial_reason: null, editorial_quality: quality }).eq("id", raw.id);
      if (scoreSaveError) throw new Error("Editorial score save: " + scoreSaveError.message);

      // Stage 2: translate only into languages actually needed by matched recipients.
      const languageMap: Record<string, string> = {
        "uz-latn": "uz_latn", "uz-cyrl": "uz_cyrl", "ru": "ru"
      };
      const requiredLanguages = [...new Set(recipients.map((recipient: NewsChat) =>
        languageMap[recipient.language] ? recipient.language : "uz-latn"
      ))];
      const { data: cached, error: cacheError } = await db.from("news_translations")
        .select("language,title,summary").eq("article_id", raw.id);
      if (cacheError) throw new Error(cacheError.message);
      const variants = new Map<string, Translation>((cached || []).map((t: TranslationRow) => [
        String(t.language), { title: String(t.title), summary: String(t.summary || "") }
      ]));
      const isCompleteTranslation = (item: unknown): item is Translation => {
        if (!item || typeof item !== "object") return false;
        const value = item as Partial<Translation>;
        return typeof value.title === "string" && value.title.trim().length > 0 &&
          typeof value.summary === "string" && value.summary.trim().length > 0;
      };
      const saveTranslation = async (language: string, item: Translation) => {
        const row = { article_id: raw.id, language, title: item.title.trim().slice(0, 500), summary: item.summary.trim().slice(0, 1400) };
        const { error: saveError } = await db.from("news_translations").upsert(row, { onConflict: "article_id,language" });
        if (saveError) throw new Error("Tarjimani saqlash (" + language + "): " + saveError.message);
        variants.set(language, { title: row.title, summary: row.summary });
      };
      const missingLanguages = requiredLanguages.filter(language => !variants.has(language));
      if (missingLanguages.length) {
        const requestedKeys = missingLanguages.map(language => languageMap[language]);
        const languageNames: Record<string, string> = {
          "uz-latn": "Uzbek Latin", "uz-cyrl": "Uzbek Cyrillic", "ru": "Russian"
        };
        const translation = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + openaiKey },
          body: JSON.stringify({
            model,
            instructions: "You are IJOD AI News translator. Translate faithfully from the original source into ONLY the requested languages. Do not add facts. Each requested language must contain a clear headline and factual 2-3 sentence summary. Preserve names, dates, numbers and uncertainty. Return a valid JSON object with exactly the requested language keys; each value has title and summary.",
            input: "Translate this already-approved story into only these requested languages: " +
              missingLanguages.map(language => languageNames[language]).join(", ") +
              ". JSON keys required: " + requestedKeys.join(", ") +
              ". Return valid json. Source context: " +
              JSON.stringify({ source: raw.source_name, title: raw.title, rss_summary: raw.summary || "", original_page_description: description, original_article_text: articleBody }),
            text: { format: { type: "json_object" } },
            max_output_tokens: 1400
          }),
          signal: AbortSignal.timeout(18000)
        });
        if (!translation.ok) throw new Error("GPT translation API: " + (await translation.text()).slice(0, 400));
        const translationResult = await translation.json();
        const translationOutput = (translationResult.output || []).flatMap((item: { content?: Array<{ type?: string; text?: string }> } | null | undefined) => item?.content || [])
          .filter((part: { type?: string }) => part.type === "output_text")
          .map((part: { text?: string }) => part.text || "").join(" ").trim();
        let translated: Record<string, unknown>;
        try { translated = JSON.parse(translationOutput) as Record<string, unknown>; }
        catch { throw new Error("GPT tarjimasi yaroqli JSON qaytarmadi."); }
        for (const language of missingLanguages) {
          const keyName = languageMap[language];
          const item = translated[keyName];
          if (!isCompleteTranslation(item)) throw new Error("GPT tarjimasi yetishmayapti: " + language);
          await saveTranslation(language, item);
        }
      }
      if (requiredLanguages.some(language => !variants.has(language))) {
        throw new Error("Foydalanuvchiga kerakli tarjima topilmadi.");
      }

      let telegramSent = 0;
      const deliveryErrors: string[] = [];
      let channelMessagesSent = 0;
      if (botToken) {
        const buttons = [[{ text: "👍", callback_data: "news_vote:" + raw.id + ":1" }, { text: "👎", callback_data: "news_vote:" + raw.id + ":-1" }],
          ...(raw.video_url ? [[{ text: "▶️ Videoni ko‘rish", url: raw.video_url }]] : []),
          [{ text: "📰 IJOD AI News’da ochish", url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ijod-ai.vercel.app") + "/news" }]];
        const { data: previousDeliveries } = await db.from("news_deliveries")
          .select("chat_id,delivery_type,status,next_attempt_at")
          .eq("article_id", raw.id);
        // "sending"/"failed" can mean Telegram accepted a request but its
        // response was lost. Never auto-send those again: Bot API has no
        // idempotency key, so retrying an ambiguous timeout creates duplicates.
        const alreadySent = new Set((previousDeliveries || []).filter((row: DeliveryRow) =>
          ["sent","sending","failed"].includes(row.status) ||
          (row.status === "retry" && row.next_attempt_at && new Date(row.next_attempt_at).getTime() > Date.now())
        ).map((row: DeliveryRow) => String(row.chat_id) + ":" + String(row.delivery_type)));
        const pendingRecipients = recipients.filter((chat: NewsChat) =>
          !alreadySent.has(chat.chatId + ":" + (chat.isChannel ? "channel" : "private"))
        );
        const deliveries = await Promise.all(pendingRecipients.map(async (chat: NewsChat) => {
          const deliveryType = chat.isChannel ? "channel" : "private";
          const item = variants.get(chat.language) || variants.get("uz-latn") || { title: raw.title, summary: raw.summary || "" };
          const caption = ("📰 " + item.title + "\n\n" + item.summary + "\n\nManba: " + raw.source_name).slice(0, 1000);
          const method = raw.image_url ? "sendPhoto" : "sendMessage";
          const payload = raw.image_url
            ? { chat_id: chat.chatId, photo: raw.image_url, caption, reply_markup: { inline_keyboard: buttons } }
            : { chat_id: chat.chatId, text: caption, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false };
          const { data: previous, error: previousError } = await db.from("news_deliveries").select("id,attempts")
            .eq("article_id", raw.id).eq("chat_id", chat.chatId).eq("delivery_type", deliveryType).maybeSingle();
          if (previousError) {
            deliveryErrors.push(chat.chatId + ": delivery history: " + previousError.message);
            return { sent: 0, channel: Boolean(chat.isChannel) };
          }
          const attempt = Number(previous?.attempts || 0) + 1;
          const { error: queueError } = await db.from("news_deliveries").upsert({
            article_id: raw.id, chat_id: chat.chatId, delivery_type: deliveryType,
            language: chat.language, status: "sending", attempts: attempt,
            next_attempt_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString()
          }, { onConflict: "article_id,chat_id,delivery_type" });
          if (queueError) {
            deliveryErrors.push(chat.chatId + ": delivery queue: " + queueError.message);
            return { sent: 0, channel: Boolean(chat.isChannel) };
          }
          let lastError = "Telegram send failed";
          let responseReceived = false;
          let telegramMessageId = "";
          try {
            const sent = await fetch("https://api.telegram.org/bot" + botToken + "/" + method, {
              method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
              signal: AbortSignal.timeout(12000)
            });
            const sentJson = await sent.json().catch(() => ({}));
            responseReceived = true;
            if (sent.ok && sentJson.ok) {
              telegramMessageId = String(sentJson.result?.message_id || "");
            } else {
              lastError = String(sentJson.description || "Telegram HTTP " + sent.status);
              // Telegram explicitly rejected this photo URL. Fall back to a text
              // post with the original article link instead of losing the story.
              if (method === "sendPhoto" && /failed to get HTTP URL content|wrong file identifier|failed to get|wrong type of the web page/i.test(lastError)) {
                const fallback = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
                  method: "POST", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ chat_id: chat.chatId, text: caption, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: false }),
                  signal: AbortSignal.timeout(12000)
                });
                const fallbackJson = await fallback.json().catch(() => ({}));
                if (fallback.ok && fallbackJson.ok) {
                  telegramMessageId = String(fallbackJson.result?.message_id || "");
                } else {
                  lastError = String(fallbackJson.description || "Telegram text fallback HTTP " + fallback.status);
                }
              }
            }
            if (telegramMessageId) {
              const { error: sentUpdateError } = await db.from("news_deliveries").update({
                status: "sent", sent_at: new Date().toISOString(),
                telegram_message_id: telegramMessageId,
                next_attempt_at: new Date().toISOString(),
                last_error: null, updated_at: new Date().toISOString()
              }).eq("article_id", raw.id).eq("chat_id", chat.chatId).eq("delivery_type", deliveryType);
              if (sentUpdateError) {
                deliveryErrors.push(chat.chatId + ": Telegram sent, but delivery status save failed: " + sentUpdateError.message);
              }
              return { sent: 1, channel: Boolean(chat.isChannel) };
            }
          } catch (deliveryError) {
            lastError = deliveryError instanceof Error ? deliveryError.message : "Telegram network error";
          }
          deliveryErrors.push(chat.chatId + ": " + lastError);
          const { error: deliveryUpdateError } = await db.from("news_deliveries").update({
            // Explicit Telegram rejection is safe to retry. Network timeouts have
            // an unknown outcome and stay failed for manual reconciliation.
            status: responseReceived ? "retry" : "failed",
            last_error: responseReceived ? lastError : "Natija noaniq; dublikat oldini olish uchun avtomatik qayta yuborilmadi: " + lastError,
            next_attempt_at: responseReceived ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq("article_id", raw.id).eq("chat_id", chat.chatId).eq("delivery_type", deliveryType);
          if (deliveryUpdateError) deliveryErrors.push(chat.chatId + ": delivery status update: " + deliveryUpdateError.message);
          return { sent: 0, channel: Boolean(chat.isChannel) };
        }));
        telegramSent += deliveries.reduce<number>((sum, item) => sum + item.sent, 0);
        channelMessagesSent += deliveries.reduce<number>((sum, item) => sum + (item.channel ? item.sent : 0), 0);
      }
      if (telegramSent > 0) {
        const { error: publishError } = await db.from("news_articles").update({
          status: "published", telegram_sent_at: new Date().toISOString(),
          processing_last_error: deliveryErrors.length ? deliveryErrors.join("; ") : null,
          processing_next_attempt_at: new Date().toISOString(),
          processing_started_at: null
        }).eq("id", raw.id);
        if (publishError) throw new Error("Maqolani nashr qilish: " + publishError.message);
      } else {
        await db.from("news_articles").update({
          status: "pending_translation",
          processing_last_error: deliveryErrors.join("; ") || "Mos Telegram qabul qiluvchisi topilmadi yoki bot tokeni mavjud emas.",
          processing_next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          processing_started_at: null
        }).eq("id", raw.id);
      }
      outcomes.push({
        id: raw.id, translated: true, telegramSent, channelMessagesSent, editorialScore: editorialScoreForOutcome,
        deliveryErrors: deliveryErrors.length ? deliveryErrors : undefined,
        matchedRecipients: recipients.length
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Processing failed";
      console.error("News processing failed", raw.id, message);
      await db.from("news_articles").update({
        processing_started_at: null,
        processing_next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        processing_last_error: message.slice(0, 1000)
      }).eq("id", raw.id).eq("status", "pending_translation");
      outcomes.push({ id: raw.id, translated: false, telegramSent: 0, error: message });
    }
  }

  return NextResponse.json({
    ok: outcomes.every(x => x.translated), phase: "translate_and_deliver",
    model, retrySummary, processed: outcomes.length, translated: outcomes.filter(x => x.translated).length,
    telegramMessagesSent: outcomes.reduce((sum, x) => sum + x.telegramSent, 0),
    channelConfigured: Boolean(channelChatId),
    channelMessagesSent: outcomes.reduce((sum, x) => sum + Number(x.channelMessagesSent || 0), 0), outcomes
  });
}
