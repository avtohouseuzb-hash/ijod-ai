import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const languages = new Set([
  "O‘zbekcha", "Ruscha", "Inglizcha", "Turkcha", "Koreyscha",
  "Nemischa", "Fransuzcha", "Arabcha", "Qozoqcha", "Qirg‘izcha", "Tojikcha", "Qoraqalpoqcha", "Turkmancha", "Yaponcha", "Xitoycha (soddalashtirilgan)", "Xitoycha (an’anaviy)", "Ispancha", "Italyancha", "Portugalcha", "Hindcha", "Urducha", "Forscha", "Indonezcha", "Malaycha", "Ukraincha", "Polyakcha", "Gollandcha", "Yunoncha", "Ibroniycha", "Bengalcha", "Tailandcha", "Vetnamcha", "Shvedcha", "Norvegcha", "Daniyacha"
]);

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY serverda sozlanmagan." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Tarjima uchun avval hisobingizga kiring." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    return NextResponse.json({ error: "Supabase server sozlamalari to‘liq emas." }, { status: 500 });
  }

  const authClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Noto‘g‘ri so‘rov." }, { status: 400 });
  }

  const { text, targetLanguage, sourceLanguage } = body as {
    text?: unknown; targetLanguage?: unknown; sourceLanguage?: unknown; imageDataUrl?: unknown;
  };
  const imageDataUrl = typeof (body as { imageDataUrl?: unknown }).imageDataUrl === "string" ? (body as { imageDataUrl: string }).imageDataUrl : "";
  const hasImage = imageDataUrl.length > 0;
  if ((!hasImage && (typeof text !== "string" || text.trim().length < 2)) || (hasImage && typeof text !== "string")) {
    return NextResponse.json({ error: "Tarjima uchun matn kiriting yoki matnli rasm yuklang." }, { status: 400 });
  }
  if (typeof text === "string" && text.length > 8000) {
    return NextResponse.json({ error: "Matn 8000 belgidan oshmasin." }, { status: 400 });
  }
  if (typeof targetLanguage !== "string" || !languages.has(targetLanguage)) {
    return NextResponse.json({ error: "Tarjima tilini tanlang." }, { status: 400 });
  }
  const source = typeof sourceLanguage === "string" && sourceLanguage.trim()
    ? sourceLanguage.trim().slice(0, 40)
    : "Avtomatik aniqlash";

  const serviceClient = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const requestId = crypto.randomUUID();
  const { data: remainingCredits, error: reserveError } = await serviceClient.rpc(
    "reserve_credit_for_user",
    { p_user_id: user.id, p_request_id: requestId },
  );
  if (reserveError) {
    console.error("Translation credit reservation failed:", reserveError.code, reserveError.message);
    if (reserveError.message.includes("Insufficient credits")) {
      return NextResponse.json({ error: "Kreditingiz tugagan." }, { status: 402 });
    }
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik.", code: reserveError.code }, { status: 500 });
  }

  let creditReserved = true;
  try {
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      instructions: "Sen professional tarjimonsan. Ma’noni, uslubni va formatni saqla. Faqat tarjima natijasini qaytar; izoh qo‘shma, agar foydalanuvchi izoh so‘ramagan bo‘lsa. Ismlar, raqamlar va havolalarni to‘g‘ri saqla.",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Manba tili: " + source + "\nMaqsad til: " + targetLanguage + "\n\n" + (typeof text === "string" && text.trim() ? "Tarjima qilinadigan matn:\n" + text.trim() : "Yuklangan rasmdagi barcha ko‘rinadigan matnni o‘qib, " + targetLanguage + " tiliga tarjima qil. Jadval, satrlar va tartibni imkon qadar saqla.") },
          ...(hasImage ? [{ type: "input_image" as const, image_url: imageDataUrl, detail: "high" as const }] : []),
        ],
      }],
      max_output_tokens: 3000,
    });
    const translatedText = response.output_text?.trim();
    if (!translatedText) throw new Error("EMPTY_TRANSLATION_RESPONSE");
    creditReserved = false;
    return NextResponse.json({ translatedText, remainingCredits });
  } catch (error) {
    const { error: refundError } = await serviceClient.rpc("refund_credit", {
      p_user_id: user.id,
      p_request_id: requestId,
      p_reason: "ai_translation_failed",
    });
    creditReserved = false;
    if (refundError) {
      console.error("Translation credit refund failed:", refundError.code, refundError.message);
    }
    console.error("IJOD AI translation error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({
      error: refundError
        ? "Tarjima bajarilmadi va kreditni avtomatik qaytarishda xatolik yuz berdi. Qo‘llab-quvvatlashga murojaat qiling."
        : "Tarjima bajarilmadi. Kredit qaytarildi, qayta urinib ko‘ring.",
    }, { status: 502 });
  }
}
