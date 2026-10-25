import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const allowedTypes = new Set([
  "Instagram posti",
  "Reklama matni",
  "Reels ssenariysi",
  "Mahsulot tavsifi",
  "Kontent g‘oyalari",
  "AI Mahsulot sotuvchi",
  "AI Kontent-reja",
  "AI Marketing maslahatchi",
  "AI Brend yaratish",
  "AI Hujjat yordamchisi",
  "AI Reels ssenariy paketi",
]);

const allowedTones = new Set([
  "Samimiy",
  "Professional",
  "Ijodiy va qiziqarli",
]);

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY serverda sozlanmagan." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!accessToken) {
    return NextResponse.json(
      { error: "Davom etish uchun avval hisobingizga kiring." },
      { status: 401 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey || !supabaseSecretKey) {
    return NextResponse.json(
      { error: "Supabase server sozlamalari to‘liq emas." },
      { status: 500 },
    );
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sessiya tugagan. Qayta kiring." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Noto‘g‘ri so‘rov." }, { status: 400 });
  }

  const { topic, type, tone, fileDataUrl, fileName, fileMimeType } = body as {
    topic?: unknown;
    type?: unknown;
    tone?: unknown;
    fileDataUrl?: unknown;
    fileName?: unknown;
    fileMimeType?: unknown;
  };

  if (typeof topic !== "string" || (topic.trim().length < 2 && !(typeof fileDataUrl === "string" && fileDataUrl.startsWith("data:")))) {
    return NextResponse.json(
      { error: "Matn kiriting yoki tahlil qilish uchun hujjat yuklang." },
      { status: 400 },
    );
  }

  if (topic.length > 4000) {
    return NextResponse.json(
      { error: "Mavzu 4000 belgidan oshmasin." },
      { status: 400 },
    );
  }

  let attachedFile: { data: string; name: string; mime: string } | null = null;
  if (fileDataUrl !== undefined && fileDataUrl !== null && fileDataUrl !== "") {
    if (typeof fileDataUrl !== "string" || typeof fileName !== "string" || typeof fileMimeType !== "string") {
      return NextResponse.json({ error: "Yuklangan hujjat ma’lumotlari noto‘g‘ri." }, { status: 400 });
    }
    const allowedMime = new Set([
      "application/pdf", "text/plain", "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword", "application/vnd.ms-excel",
    ]);
    const match = fileDataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || match[1] !== fileMimeType || !allowedMime.has(fileMimeType)) {
      return NextResponse.json({ error: "PDF, Word, Excel, CSV yoki TXT hujjatini yuklang." }, { status: 400 });
    }
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Hujjat hajmi 8 MB dan oshmasin." }, { status: 400 });
    }
    attachedFile = { data: fileDataUrl, name: fileName.slice(0, 180), mime: fileMimeType };
  }

  const safeType =
    typeof type === "string" && allowedTypes.has(type) ? type : "Boshqa";
  const safeTone =
    typeof tone === "string" && allowedTones.has(tone) ? tone : "Professional";

  const serviceClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestId = crypto.randomUUID();
  const { data: remainingCredits, error: reserveError } = await serviceClient.rpc(
    "reserve_credit_for_user",
    { p_user_id: user.id, p_request_id: requestId },
  );

  if (reserveError) {
    console.error("Credit reservation failed:", JSON.stringify({
      message: reserveError.message,
      code: reserveError.code,
      details: reserveError.details,
      hint: reserveError.hint,
    }));
    if (reserveError.message.includes("Insufficient credits")) {
      return NextResponse.json(
        { error: "Kreditingiz tugagan. Keyinroq kredit xarid qilish imkoniyatini qo‘shamiz." },
        { status: 402 },
      );
    }
    return NextResponse.json(
      { error: "Kreditni tekshirishda xatolik. Qayta urinib ko‘ring.", code: reserveError.code ?? "CREDIT_RESERVATION_FAILED" },
      { status: 500 },
    );
  }

  let creditReserved = true;
  try {
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      instructions:
        "Sen IJOD AI ichidagi O‘zbekiston bozori uchun professional AI biznes va ijod yordamchisisan. Asosan tabiiy o‘zbek tilida yoz; boshqa til so‘ralsa, o‘sha tildan foydalan. Amaliy, tayyor ishlatishga qulay natija ber, bilmagan narx yoki xususiyatlarni to‘qima. AI Mahsulot sotuvchi: marketplace nomi, SEO tavsifi, 5 afzallik, kalit so‘zlar, reklama matni va 15 soniyalik video ssenariysi. AI Kontent-reja: 7 kunlik jadval, format, hook, asosiy g‘oya va CTA. AI Marketing maslahatchi: auditoriya, taklif, 3 reklama varianti, A/B test va KPI. AI Brend yaratish: pozitsiya, auditoriya, 5 ta slogan, brend ovozi, HEX ranglar, Instagram bio, logo konsepsiyasi va logodagi matnni aniq yoz. Foydalanuvchi brend nomini bergan bo‘lsa, nomni o‘zgartirma. AI Hujjat yordamchisi: foydalanuvchi bergan matnni qisqartir, tushuntir yoki qayta yoz; matn bo‘lmasa so‘ra. AI Reels ssenariy paketi: 15–30 soniyalik kadrma-kadr ssenariy, ekrandagi matn, voiceover va CTA. Har bir topshiriqni to‘liq bajar.",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `Matn turi: ${safeType}\nOhang: ${safeTone}\nMavzu/topshiriq: ${topic.trim() || "Yuklangan hujjatni tahlil qil."}\n\nBiriktirilgan hujjat bo‘lsa, uning mazmuniga tayangan holda topshiriqni bajar. Muhim faktlarni o‘zgartirma va hujjatda yo‘q ma’lumotlarni to‘qima. Hujjatni qisqartirish, tushuntirish, xatolarini topish yoki qayta yozish topshirig‘iga mos javob ber.` },
            ...(attachedFile ? [{ type: "input_file" as const, filename: attachedFile.name, file_data: attachedFile.data }] : []),
          ],
        },
      ],
      max_output_tokens: 900,
    });

    const text = response.output_text?.trim();

    if (!text) {
      const { error: refundError } = await serviceClient.rpc("refund_credit", {
        p_user_id: user.id,
        p_request_id: requestId,
        p_reason: "ai_text_empty_response",
      });
      creditReserved = false;

      if (refundError) {
        console.error("Credit refund failed after empty AI response:", refundError.code, refundError.message);
      }

      return NextResponse.json(
        {
          error: refundError
            ? "AI bo‘sh javob qaytardi, lekin kreditni qaytarishda xatolik yuz berdi. Qo‘llab-quvvatlashga murojaat qiling."
            : "AI bo‘sh javob qaytardi. Kredit qaytarildi, qayta urinib ko‘ring.",
        },
        { status: 502 },
      );
    }

    creditReserved = false;
    let image: string | undefined;
    if (safeType === "AI Brend yaratish") {
      const logoPrompt = `Create a polished, original, professional brand logo image for the brand described below. Brand brief: ${topic.trim()}. Style: ${safeTone}. Design a clean, memorable logo mark with carefully typeset brand name and, if appropriate, a short tagline. Text in the logo must match the supplied brand name exactly; do not add unrelated words. Strong legibility, balanced composition, clean vector-like edges, flat colors, white or transparent-looking simple background, centered, suitable for Instagram profile, website and marketplace branding. No mockup, no watermark, no extra decorations, no misspelled text. Generate one square 1024x1024 logo concept.`;
      const logoResult = await openai.images.generate({
        model: "gpt-image-2.5-sunburst",
        prompt: logoPrompt,
        size: "1024x1024",
      });
      const logoB64 = logoResult.data?.[0]?.b64_json;
      if (!logoB64) throw new Error("Logo rasmi yaratilmadi.");
      image = "data:image/png;base64," + logoB64;
    }
    return NextResponse.json({ text, image, remainingCredits });
  } catch (error) {
    if (creditReserved) {
      const { error: refundError } = await serviceClient.rpc("refund_credit", {
        p_user_id: user.id,
        p_request_id: requestId,
        p_reason: "ai_text_generation_failed",
      });
      if (refundError) {
        console.error("Credit refund failed:", refundError.message);
      }
    }

    const message =
      error instanceof Error ? error.message : "Noma’lum xatolik yuz berdi.";
    console.error("IJOD AI text generation error:", message);
    return NextResponse.json(
      { error: "Matn yaratilmadi. Kreditni qaytarishga urindik. API kaliti, model va billing holatini tekshiring." },
      { status: 500 },
    );
  }
}
