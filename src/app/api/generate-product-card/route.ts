import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 120;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY serverda sozlanmagan." }, { status: 500 });
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Davom etish uchun hisobingizga kiring." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Supabase server sozlamalari to‘liq emas." }, { status: 500 });
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let body: Record<string, unknown>;
  try { const value = await request.json(); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); body = value as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }

  const productName = typeof body.productName === "string" ? body.productName.trim().slice(0, 160) : "";
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 3500) : "";
  const tone = typeof body.tone === "string" && ["Professional", "Samimiy", "Ijodiy va qiziqarli"].includes(body.tone) ? body.tone : "Professional";
  const category = typeof body.category === "string" ? body.category.slice(0, 100) : "Boshqa";
  const price = typeof body.price === "string" ? body.price.trim().slice(0, 80) : "";
  const imageDataUrl = body.imageDataUrl;
  if (productName.length < 2) return NextResponse.json({ error: "Mahsulot nomini kiriting." }, { status: 400 });
  if (details.length < 3) return NextResponse.json({ error: "Mahsulot xususiyatlarini yozing." }, { status: 400 });

  let inputImage: File | null = null;
  if (imageDataUrl !== undefined && imageDataUrl !== null && imageDataUrl !== "") {
    if (typeof imageDataUrl !== "string") return NextResponse.json({ error: "Rasm formati noto‘g‘ri." }, { status: 400 });
    const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return NextResponse.json({ error: "Faqat JPG, PNG yoki WEBP rasm yuklang." }, { status: 400 });
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Rasm hajmi 10 MB dan oshmasin." }, { status: 400 });
    inputImage = new File([bytes], "product." + (match[1] === "image/jpeg" ? "jpg" : match[1] === "image/webp" ? "webp" : "png"), { type: match[1] });
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await service.rpc("reserve_credits_for_user", { p_user_id: user.id, p_request_id: requestId, p_amount: 5 });
  if (reserveError) {
    console.error("Product card credit reservation failed:", reserveError.code, reserveError.message);
    if (reserveError.message.includes("Insufficient credits")) return NextResponse.json({ error: "Bu funksiya 5 kredit talab qiladi. Kreditlaringiz yetarli emas." }, { status: 402 });
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring." }, { status: 500 });
  }

  try {
    const textPrompt = `Sen O‘zbekiston marketplace sotuvchilari uchun professional mahsulot kartochkasi mutaxassisisan. Faqat tabiiy o‘zbek tilida, aniq va darhol ishlatish mumkin bo‘lgan tayyor natija yoz. To‘qima sertifikat, o‘lcham, material, kafolat, narx yoki tasdiqlanmagan xususiyatlarni o‘ylab topma; ma’lumot berilmagan bo‘lsa "Aniqlashtirish kerak" deb belgila. Mahsulot nomi: ${productName}. Kategoriya: ${category}. Narx: ${price || "ko‘rsatilmagan"}. Berilgan xususiyatlar: ${details}. Uslub: ${tone}. Natijani ushbu bo‘limlarda yoz: 1) UZUM MARKET KARTOCHKASI UCHUN SARLAVHA (SEO, ixcham), 2) QISQA TAVSIF, 3) TO‘LIQ TAVSIF, 4) 5–7 TA ASOSIY AFZALLIK, 5) MAHSULOT XUSUSIYATLARI (faqat ma’lum faktlar; noma’lumlari alohida), 6) QIDIRUV KALIT SO‘ZLARI, 7) RASM UCHUN 5 TA SLAYD G‘OYASI (asosiy foto va afzalliklar infografikasi), 8) REKLAMA MATNI, 9) 15 SONIYALIK REELS SSENARIYSI, 10) SOTUVDAN OLDIN ANIQLASHTIRILADIGAN MA’LUMOTLAR. Matnni chiroyli sarlavhalar va punktlar bilan yoz.`;
    const textResponse = await openai.responses.create({
      model: "gpt-6-luna",
      instructions: "Sen IJOD AI ichidagi marketplace kartochka yaratish yordamchisisan. Foydalanuvchiga tayyor natija ber, mahsulot haqidagi noma’lum faktlarni to‘qima.",
      input: [{ role: "user", content: [
        { type: "input_text", text: textPrompt },
        ...(inputImage ? [{ type: "input_image" as const, image_url: "data:" + inputImage.type + ";base64," + Buffer.from(await inputImage.arrayBuffer()).toString("base64"), detail: "high" as const }] : []),
      ] }],
      max_output_tokens: 1800,
    });
    const cardText = textResponse.output_text?.trim();
    if (!cardText) throw new Error("AI kartochka matnini qaytarmadi.");

    const imagePrompt = `Create a premium, photorealistic ecommerce product image for a marketplace listing. Product: ${productName}. Category: ${category}. Details: ${details}. Make the product the clear hero, centered, sharp, accurately shaped, with clean studio lighting, neutral light background, realistic materials and subtle shadows. No text, no watermark, no fake logo, no extra objects hiding the product. If a reference photo is supplied, preserve the exact product identity, color, shape, material, pattern, and branding; improve only presentation/background and do not redesign the item. If no photo is supplied, create a plausible product visualization based only on the written description and do not add labels or logos. Professional ecommerce catalog photography, portrait 1024x1536 composition.`;
    const imageResult = inputImage
      ? await openai.images.edit({ model: "gpt-image-2.5-sunburst", prompt: imagePrompt, image: inputImage, size: "1024x1536" })
      : await openai.images.generate({ model: "gpt-image-2.5-sunburst", prompt: imagePrompt, size: "1024x1536" });
    const b64 = imageResult.data?.[0]?.b64_json;
    if (!b64) throw new Error("AI mahsulot rasmini yaratmadi.");

    const { data: profile, error: profileError } = await service.from("profiles").select("credits").eq("user_id", user.id).maybeSingle();
    if (profileError) throw new Error("Kredit qoldig‘ini o‘qib bo‘lmadi.");
    return NextResponse.json({ text: cardText, image: "data:image/png;base64," + b64, remainingCredits: profile?.credits ?? null });
  } catch (error) {
    const { error: refundError } = await service.rpc("refund_credits_for_user", { p_user_id: user.id, p_request_id: requestId, p_reason: "ai_product_card_failed" });
    if (refundError) console.error("Product card refund failed:", refundError.code, refundError.message);
    console.error("Product card generation error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: refundError ? "Yaratish amalga oshmadi va kreditni qaytarishda xatolik yuz berdi." : "Kartochka yaratilmadi. 5 kredit qaytarildi. " + (error instanceof Error ? error.message.slice(0,250) : "Qayta urinib ko‘ring.") }, { status: 502 });
  }
}
