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
  "Professional marketing agenti",
  "Qisqa va aniq",
  "Ijodiy reklama",
  "Samimiy va ishonchli",
  "Premium brend uslubi",
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

  const { topic, type, tone, fileDataUrl, fileName, fileMimeType, analysisImageDataUrl, instagramHandle, storeUrl, marketingFocus } = body as {
    topic?: unknown;
    type?: unknown;
    tone?: unknown;
    fileDataUrl?: unknown;
    fileName?: unknown;
    fileMimeType?: unknown;
    analysisImageDataUrl?: unknown;
    instagramHandle?: unknown;
    storeUrl?: unknown;
    marketingFocus?: unknown;
  };

  const marketingLinkOnly = type === "AI Marketing maslahatchi" && ((typeof storeUrl === "string" && storeUrl.trim().length > 0) || (typeof instagramHandle === "string" && instagramHandle.trim().length > 0) || (typeof analysisImageDataUrl === "string" && analysisImageDataUrl.startsWith("data:image/")));
  if (typeof topic !== "string" || (topic.trim().length < 2 && !(typeof fileDataUrl === "string" && fileDataUrl.startsWith("data:")) && !marketingLinkOnly)) {
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

  let analysisImage: { data: string; mime: string } | null = null;
  if (analysisImageDataUrl !== undefined && analysisImageDataUrl !== null && analysisImageDataUrl !== "") {
    if (typeof analysisImageDataUrl !== "string") return NextResponse.json({ error: "Rasm formati noto‘g‘ri." }, { status: 400 });
    const match = analysisImageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return NextResponse.json({ error: "JPG, PNG yoki WEBP rasm yuklang." }, { status: 400 });
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return NextResponse.json({ error: "Rasm hajmi 8 MB dan oshmasin." }, { status: 400 });
    analysisImage = { data: analysisImageDataUrl, mime: match[1] };
  }
  const safeInstagram = typeof instagramHandle === "string" ? instagramHandle.replace(/^@/, "").trim().slice(0,80) : "";
  const safeStoreUrl = typeof storeUrl === "string" ? storeUrl.trim().slice(0,500) : "";
  const allowedMarketingFocus = new Set(["profile_audit", "brand_strategy", "image_audit", "audience", "ad_analytics"]);
  const safeMarketingFocus = Array.isArray(marketingFocus) ? marketingFocus.filter((item): item is string => typeof item === "string" && allowedMarketingFocus.has(item)).slice(0, 5) : ["profile_audit", "brand_strategy", "image_audit", "audience", "ad_analytics"];
  // Fetch public page metadata before asking the model to analyze the link.
  // Only allow Instagram and Uzum hosts to avoid SSRF.
  let pageContext = "Sahifa havolasidan avtomatik ma’lumot olinmadi.";
  let pageFetchStatus = "not_requested";
  const candidateUrl = safeStoreUrl || (safeInstagram ? "https://www.instagram.com/" + safeInstagram + "/" : "");
  if (candidateUrl) {
    try {
      const parsed = new URL(candidateUrl);
      const host = parsed.hostname.toLowerCase();
      const allowedHost = host === "instagram.com" || host.endsWith(".instagram.com") || host === "uzum.uz" || host.endsWith(".uzum.uz");
      if (!["https:", "http:"].includes(parsed.protocol) || !allowedHost) {
        pageFetchStatus = "unsupported_host";
        pageContext = "Havola qo‘llab-quvvatlanmaydi. Faqat instagram.com yoki uzum.uz havolasidan foydalaning.";
      } else {
        parsed.search = "";
        const pageResponse = await fetch(parsed.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; IJODAI-PageAnalyzer/1.0)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "uz,en;q=0.8,ru;q=0.6",
          },
          signal: AbortSignal.timeout(7000),
          redirect: "follow",
        });
        const finalUrl = new URL(pageResponse.url);
        const finalHost = finalUrl.hostname.toLowerCase();
        const finalAllowed = finalHost === "instagram.com" || finalHost.endsWith(".instagram.com") || finalHost === "uzum.uz" || finalHost.endsWith(".uzum.uz");
        if (!finalAllowed) {
          pageFetchStatus = "redirect_blocked";
          pageContext = "Sahifa boshqa domenga yo‘naltirdi, xavfsizlik uchun ochilmadi.";
        } else if (!pageResponse.ok) {
          pageFetchStatus = "http_" + pageResponse.status;
          pageContext = "Sahifa serveri HTTP " + pageResponse.status + " xatosini qaytardi.";
        } else {
          const html = (await pageResponse.text()).slice(0, 1200000);
          const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
          const metas: string[] = [];
          const metaRegex = /<meta\b[^>]*(?:property|name)=["'](?:og:title|og:description|og:image|description|twitter:title|twitter:description)["'][^>]*>/gi;
          for (const match of html.matchAll(metaRegex)) metas.push(match[0]);
          const extracted = metas.map((tag) => {
            const key = tag.match(/(?:property|name)=["']([^"']+)/i)?.[1] || "";
            const value = tag.match(/content=["']([^"']*)["']/i)?.[1] || "";
            return key + ": " + decode(value);
          });
          const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ").trim();
          const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].slice(0, 3).map((m) => m[1].replace(/<[^>]+>/g, " ").slice(0, 3000));
          const cleanMeta = [...new Set([title ? "title: " + title : "", ...extracted, ...jsonLd])].filter(Boolean);
          if (cleanMeta.length) {
            pageContext = "OCHILGAN SAHIFADAN OLINGAN MA’LUMOTLAR (to‘liq sahifa bo‘lmasligi mumkin):\n" + cleanMeta.join("\n").slice(0, 9000);
            pageFetchStatus = "metadata_extracted";
          } else {
            pageContext = "Havola serverdan ochildi, ammo o‘qiladigan profil/do‘kon metama’lumoti olinmadi. Sahifa login devori yoki JavaScript bilan yuklanishi mumkin.";
            pageFetchStatus = "no_metadata";
          }
        }
      }
    } catch (error) {
      pageFetchStatus = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "fetch_failed";
      pageContext = pageFetchStatus === "timeout" ? "Sahifa 7 soniyada javob bermadi (timeout)." : "Sahifani serverdan ochib bo‘lmadi. Platforma avtomatik so‘rovni bloklagan yoki tarmoq xatosi yuz bergan bo‘lishi mumkin.";
    }
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
        "Sen IJOD AI ichidagi O‘zbekiston bozori uchun professional AI biznes va ijod yordamchisisan. Asosan tabiiy o‘zbek tilida yoz; boshqa til so‘ralsa, o‘sha tildan foydalan. Amaliy, tayyor ishlatishga qulay natija ber, bilmagan narx yoki xususiyatlarni to‘qima. Javob ohangi " + safeTone + " bo‘lsin: Professional marketing agenti — dalillarga tayangan strategik va batafsil tavsiyalar; Qisqa va aniq — ixcham xulosalar va amaliy qadamlar; Ijodiy reklama — original hook va kreativ g‘oyalar; Samimiy va ishonchli — sodda, iliq va ishonchli til; Premium brend uslubi — nafis, sifat va eksklyuzivlikka urg‘u beruvchi ohang. AI Mahsulot sotuvchi: marketplace nomi, SEO tavsifi, 5 afzallik, kalit so‘zlar, reklama matni va 15 soniyalik video ssenariysi. AI Kontent-reja: 7 kunlik jadval, format, hook, asosiy g‘oya va CTA. AI Marketing maslahatchi: foydalanuvchi tanlagan yo‘nalishlarni alohida sarlavhalar bilan to‘liq bajar. Tanlangan marketing yo‘nalishlari: " + safeMarketingFocus.join(", ") + ". profile_audit — Instagram profili bio, pozitsiyalash, kontent, Reels va vizual uslubini dalillar asosida tekshir; brand_strategy — brend pozitsiyasi, farqlanish, ovoz ohangi va amaliy strategiya; image_audit — biriktirilgan reklama rasmining kompozitsiyasi, o‘qilishi, taklifi, CTA va yaxshilash variantlari; audience — 2–4 mijoz segmenti, ehtiyojlari, xarid to‘siqlari va mos xabarlar; ad_analytics — yuklangan reklama statistikasi skrinshotidagi ko‘rinadigan CTR, CPC, konversiya, ROAS kabi metrikalarni izohla, ko‘rinmayotgan raqamlarni taxmin qilma va kerakli formulalarni ko‘rsat. Barcha holatda aniq keyingi qadamlar va ustuvorliklarni ber. 10–20 ta SEO kaliti, 3 reklama varianti, A/B test va KPI faqat topshiriqqa mos bo‘lsa qo‘sh. Instagram username yoki do‘kon URL berilsa, faqat haqiqatan ko‘rilgan ma’lumotlar asosida tahlil qil. Sahifaga kira olmasang, buni ochiq ayt va skrinshot yoki mahsulot havolasini so‘ra; ko‘rilmagan statistika, mahsulotlar yoki raqamlarni to‘qima. Havola: " + safeStoreUrl + ". Instagram: " + safeInstagram + ". AI Brend yaratish: pozitsiya, auditoriya, 5 ta slogan, brend ovozi, HEX ranglar, Instagram bio, logo konsepsiyasi va logodagi matnni aniq yoz. Foydalanuvchi brend nomini bergan bo‘lsa, nomni o‘zgartirma. AI Hujjat yordamchisi: foydalanuvchi bergan matnni qisqartir, tushuntir yoki qayta yoz; matn bo‘lmasa so‘ra. AI Reels ssenariy paketi: 15–30 soniyalik kadrma-kadr ssenariy, ekrandagi matn, voiceover va CTA. Har bir topshiriqni to‘liq bajar.",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `Matn turi: ${safeType}\nOhang: ${safeTone}\nMavzu/topshiriq: ${topic.trim() || "Yuklangan hujjatni tahlil qil."}\nHavolani ochish holati: ${pageFetchStatus}\nSahifadan olingan kontekst:\n${pageContext}\n\nBiriktirilgan hujjat bo‘lsa, uning mazmuniga tayangan holda topshiriqni bajar. Muhim faktlarni o‘zgartirma va hujjatda yo‘q ma’lumotlarni to‘qima. Hujjatni qisqartirish, tushuntirish, xatolarini topish yoki qayta yozish topshirig‘iga mos javob ber.` },
            ...(attachedFile ? [{ type: "input_file" as const, filename: attachedFile.name, file_data: attachedFile.data }] : []),
            ...(analysisImage ? [{ type: "input_image" as const, image_url: analysisImage.data, detail: "high" as const }] : []),
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
    let projectAssetUrl: string | null = null;
    if (image) {
      try {
        const base64 = image.split(",")[1];
        const assetPath = `${user.id}/${crypto.randomUUID()}.png`;
        const { data: uploaded, error: uploadError } = await serviceClient.storage.from("ai-project-assets").upload(assetPath, Buffer.from(base64, "base64"), { contentType: "image/png", upsert: false });
        if (!uploadError && uploaded) {
          const { data: publicUrl } = serviceClient.storage.from("ai-project-assets").getPublicUrl(uploaded.path);
          projectAssetUrl = publicUrl.publicUrl;
        } else console.error("Project asset upload failed:", uploadError?.message);
      } catch (saveError) { console.error("Project asset save failed:", saveError); }
    }
    try {
      const { error: saveError } = await serviceClient.from("ai_projects").insert({
        user_id: user.id,
        title: (topic.trim() || safeType).slice(0, 120),
        service: safeType,
        result_text: text,
        asset_url: projectAssetUrl,
        prompt: topic.trim().slice(0, 4000),
      });
      if (saveError) console.error("AI text project save failed:", saveError.message);
    } catch (saveError) { console.error("AI text project save failed:", saveError); }
    return NextResponse.json({ text, image, remainingCredits, saved: true });
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
