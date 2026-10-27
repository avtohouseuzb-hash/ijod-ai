import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const prompt = body && typeof body === "object" ? (body as { prompt?: unknown }).prompt : undefined;
  const requestedSize = body && typeof body === "object" ? (body as { size?: unknown }).size : undefined;
  const imageDataUrl = body && typeof body === "object" ? (body as { imageDataUrl?: unknown }).imageDataUrl : undefined;
  const size = requestedSize === "1024x1536" || requestedSize === "1536x1024" ? requestedSize : "1024x1024";
  if (typeof prompt !== "string" || prompt.trim().length < 3) {
    return NextResponse.json({ error: "Rasm tavsifini kamida 3 ta belgi bilan kiriting." }, { status: 400 });
  }
  if (prompt.length > 2000) return NextResponse.json({ error: "Rasm tavsifi 2000 belgidan oshmasin." }, { status: 400 });
  let inputImage: File | null = null;
  if (imageDataUrl !== undefined && imageDataUrl !== null && imageDataUrl !== "") {
    if (typeof imageDataUrl !== "string") return NextResponse.json({ error: "Yuklangan rasm formati noto‘g‘ri." }, { status: 400 });
    const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return NextResponse.json({ error: "Faqat JPG, PNG yoki WEBP rasm yuklang." }, { status: 400 });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 10 * 1024 * 1024) return NextResponse.json({ error: "Rasm hajmi 10 MB dan oshmasin." }, { status: 400 });
    inputImage = new File([bytes], "product." + (match[1] === "image/jpeg" ? "jpg" : match[1] === "image/webp" ? "webp" : "png"), { type: match[1] });
  }

  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await serviceClient.rpc("reserve_credit_for_user", {
    p_user_id: user.id, p_request_id: requestId,
  });
  if (reserveError) {
    console.error("Image credit reservation failed:", reserveError.code, reserveError.message);
    if (reserveError.message.includes("Insufficient credits")) {
      return NextResponse.json({ error: "Kreditingiz yetarli emas." }, { status: 402 });
    }
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring." }, { status: 500 });
  }

  try {
    const imageOptions = { model: "gpt-image-2.5-sunburst", prompt: prompt.trim(), size };
    const result = inputImage
      ? await openai.images.edit({ ...imageOptions, image: inputImage })
      : await openai.images.generate(imageOptions);
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image API bo‘sh natija qaytardi.");

    const image = `data:image/png;base64,${b64}`;
    let assetUrl: string | null = null;
    try {
      const assetPath = `${user.id}/${crypto.randomUUID()}.png`;
      const { data: uploaded, error: uploadError } = await serviceClient.storage.from("ai-project-assets").upload(assetPath, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: false });
      if (!uploadError && uploaded) {
        const { data: publicUrl } = serviceClient.storage.from("ai-project-assets").getPublicUrl(uploaded.path);
        assetUrl = publicUrl.publicUrl;
      } else console.error("AI image asset upload failed:", uploadError?.message);
    } catch (saveError) { console.error("AI image asset upload failed:", saveError); }
    try {
      const { error: saveError } = await serviceClient.from("ai_projects").insert({
        user_id: user.id, title: prompt.trim().slice(0, 120), service: "AI Rasm",
        result_text: prompt.trim(), asset_url: assetUrl, prompt: prompt.trim(),
      });
      if (saveError) console.error("AI image project save failed:", saveError.message);
    } catch (saveError) { console.error("AI image project save failed:", saveError); }
    const { data: profile } = await serviceClient.from("profiles").select("credits").eq("user_id", user.id).maybeSingle();
    return NextResponse.json({ image, remainingCredits: profile?.credits ?? null, saved: true });
  } catch (error) {
    const { error: refundError } = await serviceClient.rpc("refund_credit", {
      p_user_id: user.id, p_request_id: requestId, p_reason: "ai_image_generation_failed",
    });
    if (refundError) console.error("Image credit refund failed:", refundError.code, refundError.message);
    console.error("IJOD AI image generation error:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: refundError
        ? "Rasm yaratilmadi va kreditni qaytarishda xatolik yuz berdi. Qo‘llab-quvvatlashga murojaat qiling."
        : "Rasm yaratilmadi. Kredit qaytarildi, qayta urinib ko‘ring.",
    }, { status: 502 });
  }
}
