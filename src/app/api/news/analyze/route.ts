import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI xizmati hozircha sozlanmagan." }, { status: 503 });
  const bearer = request.headers.get("authorization") || "";
  const accessToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!accessToken) return NextResponse.json({ error: "Davom etish uchun hisobingizga kiring." }, { status: 401 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !publishableKey || !secretKey) return NextResponse.json({ error: "Server sozlamalari to‘liq emas." }, { status: 500 });
  const auth = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });
  let body: { articleId?: unknown; question?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  if (typeof body.articleId !== "string" || body.articleId.length > 80 || (body.question !== undefined && typeof body.question !== "string")) return NextResponse.json({ error: "Maqola yoki savol noto‘g‘ri." }, { status: 400 });
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 1200) : "";
  const db = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: article, error: articleError } = await db.from("news_articles").select("id,title,summary,content,source_name,source_url,ai_analysis").eq("id", body.articleId).eq("status", "published").maybeSingle();
  if (articleError || !article) return NextResponse.json({ error: "Yangilik topilmadi." }, { status: 404 });
  if (!question && article.ai_analysis) return NextResponse.json({ answer: article.ai_analysis, cached: true });

  const requestId = crypto.randomUUID();
  const { error: reserveError } = await db.rpc("reserve_credit_for_user", { p_user_id: user.id, p_request_id: requestId });
  if (reserveError) {
    if (reserveError.message?.includes("Insufficient credits")) return NextResponse.json({ error: "AI tahlil uchun kreditingiz yetarli emas." }, { status: 402 });
    console.error("News credit reservation error", reserveError.message);
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik." }, { status: 500 });
  }
  let reserved = true;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.IJOD_NEWS_MODEL || "gpt-6-luna",
      instructions: "Sen IJOD AI News tahlilchisisan. Faqat berilgan maqola ma’lumotlariga tayangan holda javob ber. Maqolada yo‘q fakt, raqam, sana yoki sababni to‘qima. Fakt va taxminni ajrat. Savol bo‘lsa unga aniq javob ber; yetarli dalil bo‘lmasa buni ayt. Tabiiy o‘zbek lotin tilida yoz. Tahlilda: qisqa mazmun, nima uchun muhim, ehtimoliy ta’sir, noaniq yoki tekshirilishi kerak bo‘lgan jihatlar.",
      input: "Maqola sarlavhasi: " + article.title + "\nManba: " + article.source_name + "\nXulosa: " + (article.summary || "") + "\nMatn: " + (article.content || "").slice(0, 9000) + "\nAsl havola: " + article.source_url + (question ? "\n\nFoydalanuvchi savoli: " + question : "\n\nMaqolani tahlil qil."),
      max_output_tokens: 650,
    });
    const answer = response.output_text?.trim();
    if (!answer) throw new Error("AI bo‘sh javob qaytardi.");
    if (!question) {
      const { error: saveError } = await db.from("news_articles").update({ ai_analysis: answer }).eq("id", article.id);
      if (saveError) console.error("News analysis cache save failed", saveError.message);
    }
    reserved = false;
    return NextResponse.json({ answer, cached: false });
  } catch (error) {
    const { error: refundError } = await db.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "news_analysis_failed" });
    reserved = false;
    if (refundError) console.error("News analysis credit refund failed", refundError.message);
    console.error("News analysis failed", error);
    return NextResponse.json({ error: "AI tahlil tayyorlay olmadi. Kreditni qaytarishga urindik." }, { status: 502 });
  } finally {
    if (reserved) await db.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "news_analysis_aborted" });
  }
}
