import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY serverda sozlanmagan." }, { status: 500 });
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) return NextResponse.json({ error: "Davom etish uchun hisobingizga kiring." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Supabase server sozlamalari to‘liq emas." }, { status: 500 });

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "Audio fayl yuborilmadi." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "Audio fayl tanlang." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Audio fayl 25 MB dan kichik bo‘lishi kerak." }, { status: 413 });

  const supported = new Set(["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/flac", "video/mp4"]);
  if (!supported.has(audio.type) && !/\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|flac)$/i.test(audio.name)) {
    return NextResponse.json({ error: "MP3, WAV, M4A, MP4, WebM, OGG yoki FLAC fayl tanlang." }, { status: 400 });
  }

  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await serviceClient.rpc("reserve_credit_for_user", { p_user_id: user.id, p_request_id: requestId });
  if (reserveError) {
    console.error("Transcription credit reservation failed:", reserveError.code, reserveError.message);
    if (reserveError.message.includes("Insufficient credits")) return NextResponse.json({ error: "Kreditingiz yetarli emas." }, { status: 402 });
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring." }, { status: 500 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = new File([await audio.arrayBuffer()], audio.name || "recording.webm", { type: audio.type || "application/octet-stream" });
    const transcript = await openai.audio.transcriptions.create({
      model: "gpt-transcribe",
      file,
      prompt: "Transcribe the speech accurately in its original language. For Uzbek speech, use Uzbek Latin script and preserve names and wording.",
    });
    const { data: profile, error: profileError } = await serviceClient.from("profiles").select("credits").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new Error("Kredit qoldig‘ini o‘qib bo‘lmadi.");
    return NextResponse.json({ text: transcript.text, remainingCredits: profile?.credits ?? null });
  } catch (error) {
    const { error: refundError } = await serviceClient.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "audio_transcription_failed" });
    if (refundError) console.error("Transcription credit refund failed:", refundError.message);
    console.error("Audio transcription failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: refundError ? "Transkripsiya xatosi va kredit qaytarish muammosi yuz berdi." : "Audio matnga aylantirilmadi. Kredit qaytarildi; API kaliti va billingni tekshirib qayta urinib ko‘ring." }, { status: 502 });
  }
}
