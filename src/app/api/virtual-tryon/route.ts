import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 120;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME_TO_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function parseImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
  return value;
}

async function fashnRequest(path: string, init: RequestInit, apiKey: string) {
  return fetch(`https://api.fashn.ai/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI Virtual Kiyintirish hali ulanmagan. Serverda FASHN_API_KEY kalitini sozlang." }, { status: 503 });

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

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 });
  }

  const mode = body.mode === "tryon" ? "tryon" : "product";
  const productImage = parseImage(body.productImage);
  const modelImage = mode === "tryon" ? parseImage(body.modelImage) : null;
  if (!productImage) return NextResponse.json({ error: "Mahsulot rasmini JPG, PNG yoki WEBP formatida (10 MB gacha) yuklang." }, { status: 400 });
  if (mode === "tryon" && !modelImage) return NextResponse.json({ error: "Kiyib ko‘rish uchun odamning rasmini JPG, PNG yoki WEBP formatida (10 MB gacha) yuklang." }, { status: 400 });

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 500) : "";
  const resolution = body.resolution === "2k" ? "2k" : "1k";
  const generationMode = body.generationMode === "quality" ? "quality" : body.generationMode === "fast" ? "fast" : "balanced";

  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await serviceClient.rpc("reserve_credit_for_user", { p_user_id: user.id, p_request_id: requestId });
  if (reserveError) {
    console.error("Virtual try-on credit reservation failed:", reserveError.code, reserveError.message);
    if (reserveError.message.includes("Insufficient credits")) return NextResponse.json({ error: "Kreditingiz yetarli emas." }, { status: 402 });
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring." }, { status: 500 });
  }

  try {
    const modelName = mode === "tryon" ? "tryon-max" : "product-to-model";
    const inputs: Record<string, unknown> = {
      product_image: productImage,
      output_format: "png",
      num_images: 1,
      return_base64: true,
    };
    if (mode === "tryon") {
      inputs.resolution = resolution;
      inputs.generation_mode = generationMode;
    }
    if (mode === "tryon" && modelImage) inputs.model_image = modelImage;
    if (prompt) inputs.prompt = prompt;

    const startResponse = await fashnRequest("run", {
      method: "POST",
      body: JSON.stringify({ model_name: modelName, inputs }),
    }, apiKey);
    const startData = await startResponse.json().catch(() => ({}));
    if (!startResponse.ok || typeof startData.id !== "string") {
      throw new Error(typeof startData.message === "string" ? startData.message : typeof startData.error === "string" ? startData.error : "FASHN API so‘rovni qabul qilmadi.");
    }

    const deadline = Date.now() + 105_000;
    let outputUrl = "";
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const statusResponse = await fashnRequest(`status/${encodeURIComponent(startData.id)}`, { method: "GET" }, apiKey);
      const statusData = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok) throw new Error("AI natijasini tekshirishda xatolik yuz berdi.");
      if (statusData.status === "completed" && Array.isArray(statusData.output) && typeof statusData.output[0] === "string") {
        outputUrl = statusData.output[0];
        break;
      }
      if (statusData.status === "starting" || statusData.status === "in_queue" || statusData.status === "processing") continue;
      if (statusData.status === "failed") {
        const detail = typeof statusData.error?.message === "string" ? statusData.error.message : "AI rasmni yarata olmadi.";
        throw new Error(detail);
      }
    }
    if (!outputUrl) throw new Error("Rasm tayyorlanishi ko‘p vaqt oldi. Kredit qaytarildi; birozdan keyin qayta urinib ko‘ring.");

    const { data: profile, error: profileError } = await serviceClient.from("profiles").select("credits").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new Error("Natija tayyor, lekin kredit qoldig‘ini o‘qib bo‘lmadi.");
    return NextResponse.json({ image: outputUrl, remainingCredits: profile?.credits ?? null });
  } catch (error) {
    const { error: refundError } = await serviceClient.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "virtual_tryon_failed" });
    if (refundError) console.error("Virtual try-on credit refund failed:", refundError.code, refundError.message);
    console.error("Virtual try-on error:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: refundError
        ? "Rasm yaratilmadi va kreditni qaytarishda xatolik yuz berdi. Qo‘llab-quvvatlashga murojaat qiling."
        : (error instanceof Error && error.message ? `Rasm yaratilmadi: ${error.message} Kredit qaytarildi.` : "Rasm yaratilmadi. Kredit qaytarildi, qayta urinib ko‘ring."),
    }, { status: 502 });
  }
}
