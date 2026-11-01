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
  if (!user) return NextResponse.json({ error: "Mikrofonni ishlatish uchun hisobingizga qayta kiring." }, { status: 401 });
  if (process.env.IJOD_AI_VOICE_BETA_ENABLED !== "true") {
    return NextResponse.json({ error: "Ovozli AI xizmati hozircha o‘chirilgan: audio API pulli bo‘lishi mumkin. Xarajatga ruxsat berilgach yoqiladi." }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI API kaliti sozlanmagan." }, { status: 503 });
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    const language = form.get("language") === "Русский" ? "ru" : "en";
    if (!(audio instanceof File) || audio.size < 1500 || audio.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio fayl noto‘g‘ri yoki hajmi 15 MB dan katta." }, { status: 400 });
    }
    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-mini-transcribe",
      language,
      response_format: "json",
    });
    return NextResponse.json({ text: result.text || "" });
  } catch (error) {
    console.error("IJOD AI speech transcription error:", error);
    return NextResponse.json({ error: "Nutqni matnga aylantirish amalga oshmadi. Qayta urinib ko‘ring." }, { status: 502 });
  }
}
