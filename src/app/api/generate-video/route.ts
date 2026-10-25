import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const REPLICATE = "https://api.replicate.com/v1";
function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

async function uploadFile(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append("content", file, file.name);
  const response = await fetch(`${REPLICATE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json();
  if (!response.ok || !data.urls?.get) throw new Error(data.detail || data.title || "Faylni video servisiga yuklab bo‘lmadi.");
  return data.urls.get;
}

async function startPrediction(token: string, model: string, input: Record<string, unknown>) {
  const response = await fetch(`${REPLICATE}/models/${model}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.title || "Video servisi so‘rovni qabul qilmadi.");
  return data;
}

export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return jsonError("Video AI servisi hali ulanmagan. Vercel’da REPLICATE_API_TOKEN sozlanishi kerak.", 503);
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) return jsonError("Avval hisobingizga kiring.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secret) return jsonError("Supabase server sozlamalari to‘liq emas.", 500);
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(accessToken);
  if (authError || !user) return jsonError("Sessiya tugagan. Qayta kiring.", 401);
  let body: any;
  try { body = await request.json(); } catch { return jsonError("So‘rov formati noto‘g‘ri."); }
  const mode = body?.mode;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const images = Array.isArray(body?.images) ? body.images : [];
  const audioData = typeof body?.audio === "string" ? body.audio : "";
  if (!["text", "images", "lipsync"].includes(mode)) return jsonError("Video rejimi noto‘g‘ri.");
  if (mode !== "lipsync" && prompt.length < 5) return jsonError("Video tavsifini yozing.");
  if (mode === "images" && !images.length) return jsonError("Kamida bitta rasm qo‘shing.");
  if (mode === "lipsync" && (images.length !== 1 || !audioData)) return jsonError("Bitta portret va audio fayl kerak.");
  if (prompt.length > 1500 || images.length > 8) return jsonError("Tavsif yoki rasm soni limitdan oshdi.");
  const decode = (data: string, kinds: string[]) => {
    const m = data.match(/^data:(image\/(?:png|jpeg|webp)|audio\/(?:mpeg|mp3|wav|x-wav|mp4|m4a|aac|ogg));base64,([A-Za-z0-9+/=]+)$/);
    if (!m || !kinds.some(k => m[1].startsWith(k))) throw new Error("Yuklangan fayl formati qo‘llab-quvvatlanmaydi.");
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("Har bir fayl 10 MB dan oshmasin.");
    const ext = m[1].includes("jpeg") ? "jpg" : m[1].includes("png") ? "png" : m[1].includes("webp") ? "webp" : m[1].includes("wav") ? "wav" : m[1].includes("mp4") || m[1].includes("m4a") ? "m4a" : m[1].includes("ogg") ? "ogg" : "mp3";
    return new File([bytes], `upload.${ext}`, { type: m[1] });
  };
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await admin.rpc("reserve_credit_for_user", { p_user_id: user.id, p_request_id: requestId });
  if (reserveError) return jsonError(reserveError.message.includes("Insufficient credits") ? "Kreditingiz yetarli emas." : "Kreditni band qilishda xatolik yuz berdi.", reserveError.message.includes("Insufficient credits") ? 402 : 500);
  try {
    const firstImageUrl = images.length ? await uploadFile(token, decode(images[0], ["image/"])) : undefined;
    let prediction;
    if (mode === "text" || mode === "images") {
      prediction = await startPrediction(token, "minimax/video-01", {
        prompt: prompt || "Animate the provided image naturally with subtle cinematic camera movement.",
        ...(firstImageUrl ? { first_frame_image: firstImageUrl } : {}),
        prompt_optimizer: true,
      });
    } else {
      const audioUrl = await uploadFile(token, decode(audioData, ["audio/"]));
      const baseVideo = await startPrediction(token, "minimax/video-01", {
        prompt: "Create a steady, front-facing close-up portrait video. Preserve the person's identity and facial features. Subtle natural head movement, mouth relaxed, plain background, camera fixed.",
        first_frame_image: firstImageUrl,
        prompt_optimizer: true,
      });
      return NextResponse.json({ taskId: baseVideo.id, phase: "prepare_lipsync", audioUrl, requestId, remainingCredits: null });
    }
    return NextResponse.json({ taskId: prediction.id, phase: "video", requestId });
  } catch (error) {
    const { error: refundError } = await admin.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "ai_video_generation_failed" });
    console.error("AI video start failed", error instanceof Error ? error.message : error, refundError?.message);
    return jsonError(refundError ? "Video so‘rovi bajarilmadi va kreditni qaytarishda xatolik yuz berdi." : "Video so‘rovi yuborilmadi. Kredit qaytarildi.", 502);
  }
}
