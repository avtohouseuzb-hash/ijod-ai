import OpenAI from "openai";
import { recordAiUsage } from "@/lib/ai-usage";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChemistryVisualPayload =
  | { kind: "atom"; title: string; subtitle: string }
  | { kind: "molecule"; title: string; formula: string; subtitle: string; atoms: string[] }
  | { kind: "reaction"; title: string; equation: string; subtitle: string }
  | { kind: "summary"; title: string; points: string[] };

function buildChemistryVisual(question: string, answer: string): ChemistryVisualPayload {
  const q = (question + " " + answer).toLocaleLowerCase("uz-UZ").replace(/₂/g, "2").replace(/₃/g, "3");
  if (/(proton|neytron|elektron|atom|yadro)/i.test(q)) {
    return {
      kind: "atom",
      title: "Atom ichki tuzilishi",
      subtitle: "Misol: geliy atomida 2 proton va 2 neytron yadroda, 2 elektron esa yadro atrofida joylashadi. Chizma soddalashtirilgan modeldir.",
    };
  }
  if (/(nacl|osh tuzi|natriy xlorid)/i.test(q)) {
    return {
      kind: "molecule",
      title: "Osh tuzi tarkibi",
      formula: "NaCl",
      atoms: ["Na", "Cl"],
      subtitle: "Natriy xlorid natriy va xlor ionlaridan tuzilgan. Bu rasm ionli birikma tarkibini soddalashtirib ko‘rsatadi.",
    };
  }
  if (/(suv hosil|vodorod.*kislorod|h2.*o2)/i.test(q)) {
    return {
      kind: "reaction",
      title: "Suv hosil bo‘lish reaksiyasi",
      equation: "2H₂ + O₂ → 2H₂O",
      subtitle: "Tenglama muvozanatlangan: chap va o‘ng tomonda 4 ta vodorod atomi hamda 2 ta kislorod atomi bor.",
    };
  }
  if (/(h2o|suv molekul|suvning tarkib)/i.test(q)) {
    return {
      kind: "molecule",
      title: "Suv molekulasi",
      formula: "H₂O",
      atoms: ["H", "O", "H"],
      subtitle: "Suv molekulasi 2 ta vodorod (H) va 1 ta kislorod (O) atomidan tuzilgan.",
    };
  }
  if (/(co2|karbonat angidrid)/i.test(q)) {
    return {
      kind: "molecule",
      title: "Karbonat angidrid molekulasi",
      formula: "CO₂",
      atoms: ["O", "C", "O"],
      subtitle: "CO₂ molekulasida 1 ta uglerod va 2 ta kislorod atomi bor.",
    };
  }
  const points = answer.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter((part) => part.length > 18).slice(0, 4);
  return {
    kind: "summary",
    title: "Mavzuning muhim nuqtalari",
    points: points.length ? points : ["Mavzuni qismlarga bo‘lib o‘rganamiz.", "Tushunmagan joyingni ustozdan yana so‘rashing mumkin."],
  };
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI xizmati serverda sozlanmagan." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!token) return NextResponse.json({ error: "AI Ustozdan foydalanish uchun hisobingizga kiring." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) return NextResponse.json({ error: "Supabase server sozlamalari to‘liq emas." }, { status: 500 });

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Noto‘g‘ri so‘rov." }, { status: 400 });
  const input = body as { message?: unknown; history?: unknown; subject?: unknown; grade?: unknown; imageDataUrl?: unknown };
  if (typeof input.message !== "string" || !input.message.trim() || input.message.length > 2000) {
    return NextResponse.json({ error: "Savol 1–2000 belgi bo‘lishi kerak." }, { status: 400 });
  }
  const subject = typeof input.subject === "string" ? input.subject.trim().slice(0, 80) : "Matematika";
  if (!subject) return NextResponse.json({ error: "Fanni tanlang." }, { status: 400 });
  const grade = typeof input.grade === "string" && /^(?:[1-9]|10|11)-sinf$/.test(input.grade) ? input.grade : "7-sinf";
  let imageDataUrl: string | null = null;
  if (input.imageDataUrl !== undefined && input.imageDataUrl !== null && input.imageDataUrl !== "") {
    if (typeof input.imageDataUrl !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(input.imageDataUrl)) {
      return NextResponse.json({ error: "Rasm JPG, PNG yoki WEBP formatida bo‘lishi kerak." }, { status: 400 });
    }
    if (input.imageDataUrl.length > 4_200_000) {
      return NextResponse.json({ error: "Rasm hajmi 3 MB dan oshmasin." }, { status: 413 });
    }
    imageDataUrl = input.imageDataUrl;
  }

  // Greetings, unclear repeated characters, and handwriting demonstrations do not need an LLM call.
  const userMessage = input.message.trim();
  const isGreeting = /^(sal[o0][mn]|assalomu alaykum|assalom|hello|hi|hey)[!?.\s]*$/i.test(userMessage);
  const compactMessage = userMessage.replace(/\s/g, "");
  const isRepeatedNoise = compactMessage.length >= 5 && /(.)\1{4,}/.test(compactMessage);

  if (isGreeting && !imageDataUrl) {
    return NextResponse.json({
      kind: "greeting",
      text: "Salom! 😊 Bugun qaysi mavzuni o‘rganamiz? Savolingni yoz, men senga tushunarli qilib yordam beraman.",
    });
  }

  if (isRepeatedNoise && !imageDataUrl) {
    return NextResponse.json({
      kind: "greeting",
      text: "Xabaringni to‘liq tushunmadim. Iltimos, savolingni qaytadan, aniqroq yoz.",
    });
  }

  const letterMatch = userMessage.match(/\b([a-z])\s+(?:harf(?:ini|ni)?|ni)\b/i)
    ?? userMessage.match(/harf(?:ini|ni)?\s+([a-z])\b/i);
  const requestedLetter = letterMatch?.[1]?.toLocaleLowerCase("uz-UZ") ?? null;
  const isHandwritingRequest = Boolean(requestedLetter) && /(yoz|chiz|ko‘rsat|korsat)/i.test(userMessage);

  if (isHandwritingRequest && requestedLetter === "a") {
    return NextResponse.json({
      kind: "handwriting",
      text: "Kichik “a” harfini ikki harakatda yozamiz. Avval oval shakl chizamiz, keyin uning o‘ng tomonidan pastga tik chiziq tushiramiz. Pastdagi doskada ustoz chizgan yo‘nalishni kuzat, so‘ng o‘zing ham chizib ko‘r.",
      drawing: {
        title: "Kichik “a” harfi",
        subtitle: "Ikki harakat: 1) oval shakl, 2) o‘ng tomondan pastga tik chiziq.",
        strokes: [
          {
            label: "1. Qalamni o‘rta chiziqdan sal yuqoriga qo‘y. Chap tomonga tushirib, pastdan aylantir va yana tepaga qaytib oval chiz.",
            d: "M 53 25 C 40 22 30 34 30 50 C 30 66 40 77 53 75 C 64 74 70 63 70 50 C 70 37 64 27 53 25",
          },
          {
            label: "2. Ovalning o‘ng yuqori qismidan boshlab, tik chiziqni pastga tushir.",
            d: "M 70 26 L 70 76",
          },
        ],
      },
    });
  }

  if (isHandwritingRequest && requestedLetter) {
    return NextResponse.json({
      kind: "lesson",
      text: "“" + requestedLetter + "” harfini yozishni tushuntirib beraman. Hozircha chizib ko‘rsatish mashqi kichik “a” harfi uchun tayyorlangan. Boshqa harflarning chizma ketma-ketligini ham qo‘shamiz.",
    });
  }
  const history = Array.isArray(input.history)
    ? input.history.slice(-10).filter((item): item is { role: "user" | "assistant"; content: string } =>
        !!item && typeof item === "object" &&
        ["user", "assistant"].includes(String((item as { role?: unknown }).role)) &&
        typeof (item as { content?: unknown }).content === "string"
      ).map(item => ({ role: item.role, content: item.content.slice(0, 1800) }))
    : [];

  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const gradeNumber = Number(grade.split("-")[0]);
  const { data: collection } = await service.from("edu_textbook_collections")
    .select("openai_vector_store_id").eq("grade", gradeNumber).eq("subject", subject).maybeSingle();
  const vectorStoreId = collection?.openai_vector_store_id as string | null;
  const { count: readyBookCount } = await service.from("edu_textbooks")
    .select("id", { count: "exact", head: true }).eq("grade", gradeNumber).eq("subject", subject).eq("status", "ready");
  const useTextbook = Boolean(vectorStoreId && readyBookCount);
  const sourceGuidance = useTextbook
    ? " Rasmiy darslik qidiruvi yoqilgan: faqat shu sinf va fan uchun indekslangan kitoblarga tayangan holda javob ber. Topilgan manba bo‘lmasa sahifa yoki mashq raqamini aytma."
    : " Hozircha shu sinf va fan uchun PDF darslik indekslanmagan. Umumiy fan bilimlari asosida o‘rgat, lekin javobni rasmiy darslikdan olingandek ko‘rsatma. Sahifa, bob yoki mashq raqamini taxmin qilma; o‘quvchi aniq kitobdagi topshiriqni so‘rasa, matnini yoki rasmini yuborishini so‘ra.";
  const chemistryGuidance = subject.toLocaleLowerCase("uz-UZ").includes("kimyo")
    ? " Kimyo fanida quruq uzun matn yozma: o‘quvchini qiziqtiradigan qisqa izoh, kundalik hayotdan o‘xshatish, kichik tajriba yoki kuzatuv va bitta savol ber. Xavfli moddalar bilan uyda tajriba qilishni buyurma. Atom, molekula va reaksiya kabi narsalarni tasavvur qilishiga yordam ber."
    : "";
  const imageGuidance = imageDataUrl
    ? " O‘quvchi rasm yubordi. Rasmni diqqat bilan ko‘r: undagi topshiriq, formula yoki xatoni aniqlab, ko‘rinmayotgan joylarni taxmin qilmasdan so‘ra."
    : "";
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await service.rpc("reserve_credit_for_user", { p_user_id: user.id, p_request_id: requestId });
  if (reserveError) {
    if (reserveError.message.includes("Insufficient credits")) return NextResponse.json({ error: "Kreditingiz tugagan. AI Ustoz bilan davom etish uchun hisobingizni to‘ldiring." }, { status: 402 });
    console.error("School tutor credit reservation failed:", reserveError.message);
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik yuz berdi." }, { status: 500 });
  }

  let reserved = true;
  try {
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      instructions: `Sen IJOD EDU platformasining shaxsiy AI ustozisan. O‘quvchi sinfi: ${grade}. Tanlangan fan: ${subject}. Har doim tabiiy, sodda va to‘g‘ri o‘zbek tilida gapir; ingliz tili fanida inglizcha misol va o‘zbekcha izoh ber. O‘quvchining yoshiga mos, mehribon, sabrli va rag‘batlantiruvchi bo‘l.\n\nMUHIM SUHBAT QOIDALARI: Agar o‘quvchi salomlashsa, oddiy va iliq salom qaytarib, bugun nimani o‘rganishni xohlashini so‘ra. Bunday paytda MAVZU, qadamlar yoki XULOSA sarlavhalarini ishlatma. Agar xabar tushunarsiz, takroriy harflar yoki ma’nosiz belgilar bo‘lsa, muloyimlik bilan savolni qayta yozishni so‘ra; tasodifiy javob bermagin. Savol fan mavzusiga oid bo‘lsa, mavzuni tushuntir, keyin bitta kichik savol bilan tushunganini tekshir.\n\nDARS TUSHUNTIRISH: Sinf darajasidan murakkab termin ishlatma va yangi terminni izohla. Matematik/fizik masalalarda yechimni bosqichma-bosqich, formula va birliklar bilan ko‘rsat. Kimyoda elementlar va reaksiyalarni aniq yoz. Tarix, geografiya va biologiyada sabab-oqibat hamda hayotiy misol keltir. Faqat darsga oid savolga javob berganda birinchi satrda to‘liq MAVZU: nomini yoz; keyin kerakli qadamlar, oxirida XULOSA: va ENDI SEN: bilan bitta mashq ber. Javobni hech qachon yarim so‘z yoki kesik sarlavha bilan tugatma. Odatda 100–180 so‘zdan oshirma, ammo masalani to‘liq tushuntirish uchun zarur qadamlarni qoldirma. Bilmagan faktni to‘qima. ${sourceGuidance}${chemistryGuidance}${imageGuidance}`,
      input: [
        ...history.map(item => ({ role: item.role, content: item.content })),
        {
          role: "user" as const,
          content: [
            { type: "input_text" as const, text: "Sinf: " + grade + ". Fan: " + subject + ". Savol: " + input.message.trim() },
            ...(imageDataUrl ? [{ type: "input_image" as const, image_url: imageDataUrl, detail: "auto" as const }] : []),
          ],
        },
      ],
      ...(useTextbook ? { tools: [{ type: "file_search" as const, vector_store_ids: [vectorStoreId as string], max_num_results: 5 }], include: ["file_search_call.results" as const] } : {}),
      max_output_tokens: 1800,
    });
    await recordAiUsage(service, { userId: user.id, requestId, feature: "IJOD EDU · AI Ustoz", model: "gpt-6-luna", usage: response.usage });
    const outputMessageText = response.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content)
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    let text = response.output_text?.trim() || outputMessageText;
    text = text.replace(/\*\*/g, "").trim();
    const isTruncatedHeading = /^(M|MA|MAV|MAVZ|MAVZU:?|XULOSA:?)$/i.test(text);
    if (response.status === "incomplete" || isTruncatedHeading || !text) {
      throw new Error("AI javobi to‘liq kelmadi. Iltimos, yana bir marta yubor.");
    }

    reserved = false;
    const visual = subject.toLocaleLowerCase("uz-UZ").includes("kimyo")
      ? buildChemistryVisual(userMessage, text)
      : undefined;
    const youtubeQuery = subject.toLocaleLowerCase("uz-UZ").includes("kimyo")
      ? `${grade} kimyo ${userMessage} mavzusi o‘zbek tilida`.slice(0, 180)
      : undefined;
    return NextResponse.json({
      text,
      kind: "lesson",
      ...(visual ? { visual } : {}),
      ...(youtubeQuery ? { youtubeQuery } : {}),
      sourceMode: useTextbook ? "textbook" : "general",
    });
  } catch (error) {
    if (reserved) {
      const { error: refundError } = await service.rpc("refund_credit", {
        p_user_id: user.id, p_request_id: requestId, p_reason: "school_tutor_failed",
      });
      if (refundError) console.error("School tutor credit refund failed:", refundError.message);
    }
    console.error("School tutor error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "AI Ustoz hozir javob bera olmadi. Kreditni qaytarishga urindik. Birozdan keyin qayta urinib ko‘ring." }, { status: 502 });
  }
}
