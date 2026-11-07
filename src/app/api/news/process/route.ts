import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;

type Translation = { title: string; summary: string };
type EditorialResult = { publish: boolean; reason?: string; uz_latn: Translation; uz_cyrl: Translation; ru: Translation };
type Article = { id: string; title: string; summary: string | null; source_name: string; source_url: string; image_url: string | null; video_url: string | null; category: string; status: string };
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
function matchesTopics(article: Article, selected: string[]) {
  // No interests means no delivery; never interpret an empty selection as "all news".
  if (!selected.length) return false;
  const allowedParents = parentCategories(selected);
  return allowedParents.includes(article.category);
}

async function fetchArticleContext(articleUrl: string): Promise<ArticleContext> {
  try {
    const response = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IJODAI-NewsBot/1.0)", "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow", signal: AbortSignal.timeout(5000)
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
  // Do not broadcast every article to a public channel: delivery must respect
  // each subscriber's selected categories. Channel publishing needs a separate explicit opt-in.

  // Select news for subscriber interests first. A global LIMIT(5) used to let
  // unrelated categories fill the queue, so private subscribers received only
  // one matching story while the public channel received the whole batch.
  const interestedCategories = [...new Set(chats.flatMap(chat => parentCategories(chat.categories)))];
  let articleQuery = db.from("news_articles")
    .select("id,title,summary,source_name,source_url,image_url,video_url,category,status")
    .eq("status", "pending_translation").order("published_at", { ascending: false });
  if (interestedCategories.length) articleQuery = articleQuery.in("category", interestedCategories);
  const { data: articles, error } = await articleQuery.limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!articles?.length) return NextResponse.json({ ok: true, processed: 0, message: "Tanlangan mavzularda tarjima kutayotgan yangi maqola yo‘q." });

  const model = process.env.IJOD_NEWS_TRANSLATION_MODEL || process.env.IJOD_NEWS_MODEL || "gpt-6-luna";
  const outcomes: Array<{ id: string; translated: boolean; telegramSent: number; error?: string }> = [];

  for (const raw of articles as Article[]) {
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
        await db.from("news_articles").update({ status: "draft" }).eq("id", raw.id);
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
          })
        });
        if (!ai.ok) throw new Error("GPT API: " + (await ai.text()).slice(0, 400));
        const result = await ai.json();
        const output = (result.output || []).flatMap((item: { content?: Array<{ type?: string; text?: string }> } | null | undefined) => item?.content || [])
          .filter((part: { type?: string }) => part.type === "output_text")
          .map((part: { text?: string }) => part.text || "").join(" ").trim();
        const parsed = JSON.parse(output) as EditorialResult;
        if (parsed.publish !== true) {
          await db.from("news_articles").update({ status: "draft" }).eq("id", raw.id);
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

      const { error: publishError } = await db.from("news_articles").update({ status: "published" }).eq("id", raw.id);
      if (publishError) throw new Error("Maqolani nashr qilish: " + publishError.message);

      let telegramSent = 0;
      if (botToken) {
        const buttons = [[{ text: "🔗 To‘liq yangilik", url: raw.source_url }],
          ...(raw.video_url ? [[{ text: "▶️ Videoni ko‘rish", url: raw.video_url }]] : []),
          [{ text: "📰 IJOD AI News’da ochish", url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ijod-ai.vercel.app") + "/news" }]];
        for (const chat of chats) {
          if (chat.categories.length && !matchesTopics(raw, chat.categories)) continue;
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
