import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const allowedTypes = new Set([
  "Instagram posti",
  "Reklama matni",
  "Reels ssenariysi",
  "Mahsulot tavsifi",
  "Kontent g‘oyalari",
  "AI Mahsulot sotuvchi",
  "AI Kontent-reja",
  "AI Marketing maslahatchi",
  "AI Brend yaratish",
  "AI Hujjat yordamchisi",
  "AI Reels ssenariy paketi",
]);

const allowedTones = new Set([
  "Samimiy",
  "Professional",
  "Ijodiy va qiziqarli",
]);

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY serverda sozlanmagan." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!accessToken) {
    return NextResponse.json(
      { error: "Davom etish uchun avval hisobingizga kiring." },
      { status: 401 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey || !supabaseSecretKey) {
    return NextResponse.json(
      { error: "Supabase server sozlamalari to‘liq emas." },
      { status: 500 },
    );
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sessiya tugagan. Qayta kiring." },
      { status: 401 },
    );
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

  const { topic, type, tone } = body as {
    topic?: unknown;
    type?: unknown;
    tone?: unknown;
  };

  if (typeof topic !== "string" || topic.trim().length < 2) {
    return NextResponse.json(
      { error: "Mavzuni kamida 2 ta belgi bilan kiriting." },
      { status: 400 },
    );
  }

  if (topic.length > 4000) {
    return NextResponse.json(
      { error: "Mavzu 4000 belgidan oshmasin." },
      { status: 400 },
    );
  }

  const safeType =
    typeof type === "string" && allowedTypes.has(type) ? type : "Boshqa";
  const safeTone =
    typeof tone === "string" && allowedTones.has(tone) ? tone : "Professional";

  const serviceClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestId = crypto.randomUUID();
  const { data: remainingCredits, error: reserveError } = await serviceClient.rpc(
    "reserve_credit_for_user",
    { p_user_id: user.id, p_request_id: requestId },
  );

  if (reserveError) {
    console.error("Credit reservation failed:", JSON.stringify({
      message: reserveError.message,
      code: reserveError.code,
      details: reserveError.details,
      hint: reserveError.hint,
    }));
    if (reserveError.message.includes("Insufficient credits")) {
      return NextResponse.json(
        { error: "Kreditingiz tugagan. Keyinroq kredit xarid qilish imkoniyatini qo‘shamiz." },
        { status: 402 },
      );
    }
    return NextResponse.json(
      { error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring.", code: reserveError.code ?? "CREDIT_RESERVATION_FAILED" },
      { status: 500 },
    );
  }

  let creditReserved = true;
  try {
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      instructions:
        "Sen IJOD AI ichidagi O‘zbekiston bozori uchun professional AI biznes va ijod yordamchisisan. Asosan tabiiy o‘zbek tilida yoz; boshqa til so‘ralsa, o‘sha tildan foydalan. Amaliy, tayyor ishlatishga qulay natija ber, bilmagan narx yoki xususiyatlarni to‘qima. AI Mahsulot sotuvchi: marketplace nomi, SEO tavsifi, 5 afzallik, kalit so‘zlar, reklama matni va 15 soniyalik video ssenariysi. AI Kontent-reja: 7 kunlik jadval, format, hook, asosiy g‘oya va CTA. AI Marketing maslahatchi: auditoriya, taklif, 3 reklama varianti, A/B test va KPI. AI Brend yaratish: pozitsiya, auditoriya, sloganlar, ovoz uslubi, HEX rang tavsiyalari va Instagram bio. AI Hujjat yordamchisi: foydalanuvchi bergan matnni qisqartir, tushuntir yoki qayta yoz; matn bo‘lmasa so‘ra. AI Reels ssenariy paketi: 15–30 soniyalik kadrma-kadr ssenariy, ekrandagi matn, voiceover va CTA. Har bir topshiriqni to‘liq bajar.",
      input: [
        {
          role: "user",
          content: `Matn turi: ${safeType}\nOhang: ${safeTone}\nMavzu/topshiriq: ${topic.trim()}\n\nShu ma’lumotlar asosida tayyor, foydalanishga qulay matn yoz.`,
        },
      ],
      max_output_tokens: 900,
    });

    const text = response.output_text?.trim();

    if (!text) {
      const { error: refundError } = await serviceClient.rpc("refund_credit", {
        p_user_id: user.id,
        p_request_id: requestId,
        p_reason: "ai_text_empty_response",
      });
      creditReserved = false;

      if (refundError) {
        console.error("Credit refund failed after empty AI response:", refundError.code, refundError.message);
      }

      return NextResponse.json(
        {
          error: refundError
            ? "AI bo‘sh javob qaytardi, lekin kreditni qaytarishda xatolik yuz berdi. Qo‘llab-quvvatlashga murojaat qiling."
            : "AI bo‘sh javob qaytardi. Kredit qaytarildi, qayta urinib ko‘ring.",
        },
        { status: 502 },
      );
    }

    creditReserved = false;
    return NextResponse.json({ text, remainingCredits });
  } catch (error) {
    if (creditReserved) {
      const { error: refundError } = await serviceClient.rpc("refund_credit", {
        p_user_id: user.id,
        p_request_id: requestId,
        p_reason: "ai_text_generation_failed",
      });
      if (refundError) {
        console.error("Credit refund failed:", refundError.message);
      }
    }

    const message =
      error instanceof Error ? error.message : "Noma’lum xatolik yuz berdi.";
    console.error("IJOD AI text generation error:", message);
    return NextResponse.json(
      { error: "Matn yaratilmadi. Kreditni qaytarishga urindik. API kaliti, model va billing holatini tekshiring." },
      { status: 500 },
    );
  }
}
