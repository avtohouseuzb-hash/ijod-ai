import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const allowedVoices = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "nova", "onyx", "sage", "shimmer", "verse",
]);

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY serverda sozlanmagan." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) return NextResponse.json({ error: "Davom etish uchun hisobingizga kiring." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "Supabase server sozlamalari to‘liq emas." }, { status: 500 });
  }

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 });
  }
  const input = body && typeof body === "object" ? (body as { text?: unknown }).text : undefined;
  const requestedVoice = body && typeof body === "object" ? (body as { voice?: unknown }).voice : undefined;
  const voice = typeof requestedVoice === "string" && allowedVoices.has(requestedVoice) ? requestedVoice : "alloy";

  if (typeof input !== "string" || input.trim().length < 2) {
    return NextResponse.json({ error: "Ovozga aylantirish uchun matn kiriting (kamida 2 ta belgi)." }, { status: 400 });
  }
  if (input.length > 4000) {
    return NextResponse.json({ error: "Matn 4000 belgidan oshmasin." }, { status: 400 });
  }

  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await serviceClient.rpc("reserve_credit_for_user", {
    p_user_id: user.id, p_request_id: requestId,
  });
  if (reserveError) {
    console.error("Audio credit reservation failed:", reserveError.code, reserveError.message);
    if (reserveError.message.includes("Insufficient credits")) {
      return NextResponse.json({ error: "Kreditingiz yetarli emas." }, { status: 402 });
    }
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring." }, { status: 500 });
  }

  try {
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: input.trim(),
      response_format: "mp3",
      instructions: "Speak clearly and naturally in the same language as the input. Preserve the original language and pronunciation; do not translate.",
    });
    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    if (!audioBuffer.length) throw new Error("Audio API bo‘sh fayl qaytardi.");

    const { data: profile } = await serviceClient.from("profiles").select("credits").eq("user_id", user.id).maybeSingle();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="ijod-ai-voice.mp3"',
        "Cache-Control": "no-store",
        "X-Remaining-Credits": String(profile?.credits ?? ""),
      },
    });
  } catch (error) {
    const { error: refundError } = await serviceClient.rpc("refund_credit", {
      p_user_id: user.id, p_request_id: requestId, p_reason: "ai_speech_generation_failed",
    });
    if (refundError) console.error("Audio credit refund failed:", refundError.code, refundError.message);
    console.error("IJOD AI audio generation error:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: refundError
        ? "Ovoz yaratilmadi va kreditni qaytarishda xatolik yuz berdi. Qo‘llab-quvvatlashga murojaat qiling."
        : "Ovoz yaratilmadi. Kredit qaytarildi, API kaliti va billing holatini tekshirib qayta urinib ko‘ring.",
    }, { status: 502 });
  }
}
