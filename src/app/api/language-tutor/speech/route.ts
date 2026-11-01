import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function authorizedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

export async function POST(request: Request) {
  const user = await authorizedUser(request);
  if (!user) return NextResponse.json({ error: "Ovozli javob uchun hisobingizga qayta kiring." }, { status: 401 });
  if (process.env.IJOD_AI_VOICE_BETA_ENABLED !== "true") {
    return NextResponse.json({ error: "Tabiiy AI ovozi hozircha o‘chirilgan: audio API pulli bo‘lishi mumkin. Xarajatga ruxsat berilgach yoqiladi." }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI API kaliti sozlanmagan." }, { status: 503 });
  try {
    const body = await request.json();
    const input = typeof body.text === "string" ? body.text.trim() : "";
    if (!input || input.length > 4000) return NextResponse.json({ error: "Ovozga aylantiriladigan matn 1–4000 belgi bo‘lishi kerak." }, { status: 400 });
    const voice = ["coral", "ash", "marin"].includes(body.voice) ? body.voice : "coral";
    const language = body.language === "Русский" ? "Russian" : "English";
    const moodInstructions: Record<string, string> = {
      neutral: "Speak naturally, clearly, and calmly.",
      kind: "Speak warmly, gently, and encouragingly.",
      happy: "Speak with cheerful, lively energy, but naturally.",
      angry: "Speak firmly and confidently, never shout or sound aggressive.",
      thinking: "Speak thoughtfully, with measured pacing.",
      sleepy: "Speak softly and slowly, while remaining clear.",
    };
    const result = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input,
      instructions: `Speak in natural conversational ${language}, with authentic pronunciation and smooth pacing. ${moodInstructions[body.mood] || moodInstructions.neutral} Read only the supplied text. Do not announce punctuation, emojis, or formatting.`,
      response_format: "mp3",
    });
    return new Response(await result.arrayBuffer(), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("IJOD AI speech synthesis error:", error);
    return NextResponse.json({ error: "Tabiiy ovoz yaratilmadi. Qayta urinib ko‘ring." }, { status: 502 });
  }
}
