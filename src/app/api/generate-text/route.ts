import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const allowedTypes = new Set([
  "Instagram post",
  "Instagram Reels",
  "Reklama",
  "Mahsulot tavsifi",
  "Blog maqolasi",
  "Boshqa",
]);

const allowedTones = new Set([
  "Professional",
  "Do‘stona",
  "Sotuvga yo‘naltirilgan",
  "Ijodiy",
  "Rasmiy",
]);

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY serverda sozlanmagan." },
      { status: 500 },
    );
  }

  try {
    const body: unknown = await request.json();

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
      return NextResponse.json(
        { error: "AI bo‘sh javob qaytardi. Qayta urinib ko‘ring." },
        { status: 502 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Noma’lum xatolik yuz berdi.";
    console.error("IJOD AI text generation error:", message);
    return NextResponse.json(
      { error: "Matn yaratilmadi. API kaliti, model va billing holatini tekshiring." },
      { status: 500 },
    );
  }
}
