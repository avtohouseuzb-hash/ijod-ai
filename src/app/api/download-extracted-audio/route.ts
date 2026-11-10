import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
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

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "Audio fayl yuborilmadi." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "Yuklab olish uchun audio fayl topilmadi." }, { status: 400 });
  }
  if (audio.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio fayl 200 MB dan oshmasin." }, { status: 413 });
  }
  if (!audio.type.startsWith("audio/")) {
    return NextResponse.json({ error: "Faqat audio fayl qabul qilinadi." }, { status: 400 });
  }

  // Downloading an already-extracted file is a file transfer, not an AI generation.
  // Never charge credits here; repeated requests must remain free and safe.
  try {
    const bytes = Buffer.from(await audio.arrayBuffer());
    if (!bytes.length) return NextResponse.json({ error: "Audio fayl bo‘sh." }, { status: 400 });
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": audio.type || "audio/webm",
        "Content-Disposition": 'attachment; filename="ijod-ai-video-audio.webm"',
        "Cache-Control": "private, no-store",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (err) {
    console.error("Extracted audio download failed:", err);
    return NextResponse.json({ error: "Audio yuklab olishda xatolik yuz berdi." }, { status: 500 });
  }
}
