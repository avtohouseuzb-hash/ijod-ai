import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const allowedVoices = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable", "marin",
  "cedar", "nova", "onyx", "sage", "shimmer", "verse",
]);

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY serverda sozlanmagan." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return NextResponse.json({ error: "Supabase sozlamalari to‘liq emas." }, { status: 500 });
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await authClient.auth.getUser(accessToken);
  if (error || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 });
  }
  const requested = body && typeof body === "object" ? (body as { voice?: unknown }).voice : undefined;
  const voice = typeof requested === "string" && allowedVoices.has(requested) ? requested : "alloy";

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: "Assalomu alaykum! Bu IJOD AI ovoz namunasidir.",
      response_format: "mp3",
      instructions: "Speak clearly and naturally in Uzbek. This is a short voice preview.",
    });
    return new Response(Buffer.from(await speech.arrayBuffer()), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Voice preview failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Namuna ovoz yaratilmadi. OpenAI API kaliti va billing holatini tekshiring." }, { status: 502 });
  }
}
