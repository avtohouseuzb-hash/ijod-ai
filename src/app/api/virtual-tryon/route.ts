import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 120;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function parseImage(value: unknown): { dataUrl: string; mime: string } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
  return { dataUrl: value, mime: match[1] };
}

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
  const resolution = body.resolution === "2k" ? "high" : "medium";
  const aspectRatio = typeof body.aspectRatio === "string" && ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2", "4:5", "5:4"].includes(body.aspectRatio) ? body.aspectRatio : "3:4";
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await serviceClient.rpc("reserve_credit_for_user", { p_user_id: user.id, p_request_id: requestId });
  if (reserveError) {
    console.error("Virtual try-on credit reservation failed:", reserveError.code, reserveError.message);
    if (reserveError.message.includes("Insufficient credits")) return NextResponse.json({ error: "Kreditingiz yetarli emas." }, { status: 402 });
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring." }, { status: 500 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const taskInstructions = mode === "tryon"
      ? "Perform a realistic virtual try-on edit. Use the first input image as the exact product reference and the second input image as the person. Put the referenced wearable product on that same person. Preserve the person's identity, face, body shape, pose, skin tone, and background as much as possible. Preserve the product's original design, colors, material, pattern, shape, and visible branding. Do not invent logos or change product details. For shoes, show them naturally worn on the person's feet; for glasses, place them correctly on the face; for hats, bags and jewelry, position them realistically. If the product is not clothing, adapt the edit to the product category. Create a photorealistic ecommerce-quality result."
      : "Create a photorealistic ecommerce fashion product photo using the uploaded product as the exact reference. Show a realistic adult AI fashion model wearing or using the product naturally, with the whole relevant product clearly visible. Preserve the product's original design, colors, material, pattern, shape, and visible branding as faithfully as possible. Do not invent or alter logos. For shoes, show the model wearing them and keep the shoes clearly visible; for glasses, place them correctly on the face; for bags, jewelry, hats and other accessories, show them worn or used naturally. Use tasteful studio lighting and a clean professional background. Avoid text, watermarks, extra limbs, distorted hands, or duplicate products.";
    const fullPrompt = [taskInstructions, prompt ? "User's extra instructions: " + prompt : "", "Desired composition aspect ratio: " + aspectRatio + ". Output a single finished image."].filter(Boolean).join("\n\n");
    const inputContent: Array<Record<string, unknown>> = [
      { type: "input_text", text: fullPrompt },
      { type: "input_image", image_url: productImage.dataUrl, detail: "high" },
    ];
    if (mode === "tryon" && modelImage) inputContent.push({ type: "input_image", image_url: modelImage.dataUrl, detail: "high" });

    // GPT-6 Luna handles the visual reasoning; OpenAI's built-in image tool renders the edited image.
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      input: [{ role: "user", content: inputContent as never }],
      tools: [{ type: "image_generation", model: "gpt-image-2.5-sunburst", action: "edit", size: "auto", quality: resolution }],
    });
    const imageCall = response.output.find((item) => item.type === "image_generation_call");
    const imageBase64 = imageCall && "result" in imageCall ? imageCall.result : undefined;
    if (typeof imageBase64 !== "string" || !imageBase64) throw new Error("GPT-6 Luna javob berdi, ammo rasm generatsiyasi natija qaytarmadi.");

    const { data: profile, error: profileError } = await serviceClient.from("profiles").select("credits").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new Error("Natija tayyor, lekin kredit qoldig‘ini o‘qib bo‘lmadi.");
    return NextResponse.json({ image: "data:image/png;base64," + imageBase64, remainingCredits: profile?.credits ?? null });
  } catch (error) {
    const { error: refundError } = await serviceClient.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "virtual_tryon_failed" });
    if (refundError) console.error("Virtual try-on credit refund failed:", refundError.code, refundError.message);
    const message = error instanceof Error ? error.message : "Noma’lum API xatosi.";
    console.error("GPT-6 Luna virtual try-on error:", message);
    return NextResponse.json({
      error: refundError
        ? "Rasm yaratilmadi va kreditni qaytarishda xatolik yuz berdi. Qo‘llab-quvvatlashga murojaat qiling."
        : "Rasm yaratilmadi. Kredit qaytarildi. " + message.slice(0, 350),
    }, { status: 502 });
  }
}
