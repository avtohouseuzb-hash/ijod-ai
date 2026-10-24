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

  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: remainingCredits, error: reserveError } = await userClient.rpc("reserve_credit");

  if (reserveError) {
    if (reserveError.message.includes("Insufficient credits")) {
      return NextResponse.json(
        { error: "Kreditingiz tugagan. Keyinroq kredit xarid qilish imkoniyatini qo‘shamiz." },
        { status: 402 },
      );
    }
    console.error("Credit reservation failed:", reserveError.message);
    return NextResponse.json(
      { error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring." },
      { status: 500 },
    );
  }

  const serviceClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let creditReserved = true;
  try {
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      instructions:
        "Sen IJOD AI ichidagi o‘zbek tilida ishlaydigan matn yordamchisisan. Foydalanuvchi so‘roviga aniq, foydali va tabiiy o‘zbek tilida javob ber. Kerak bo‘lsa sarlavha va qisqa ro‘yxatlardan foydalan. Foydalanuvchi boshqa tilni aniq so‘rasa, o‘sha tilda yoz.",
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
      await serviceClient.rpc("refund_credit", {
        p_user_id: user.id,
        p_reason: "ai_text_empty_response",
      });
      creditReserved = false;
      return NextResponse.json(
        { error: "AI bo‘sh javob qaytardi. Kredit qaytarildi, qayta urinib ko‘ring." },
        { status: 502 },
      );
    }

    creditReserved = false;
    return NextResponse.json({ text, remainingCredits });
  } catch (error) {
    if (creditReserved) {
      const { error: refundError } = await serviceClient.rpc("refund_credit", {
        p_user_id: user.id,
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
