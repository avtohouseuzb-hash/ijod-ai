import OpenAI from "openai";
import { recordAiUsage } from "@/lib/ai-usage";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildEduLiveWhiteboard, validateEduLiveWhiteboard } from "@/lib/edu-live/lesson-whiteboard";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChemistryVisualPayload =
  | { kind: "atom"; title: string; subtitle: string }
  | { kind: "orbital"; title: string; subtitle: string }
  | { kind: "molecule"; title: string; formula: string; subtitle: string; atoms: string[] }
  | { kind: "reaction"; title: string; equation: string; subtitle: string }
  | { kind: "summary"; title: string; points: string[] };
type TutorStructuredResponse = {
  answer: string;
  board: {
    title: string;
    explanation: string;
    steps: string[];
    formula: string;
    example: string;
    summary: string;
    checkQuestion: string;
    diagram: {
      kind: "none" | "flow" | "timeline" | "comparison" | "concept_map";
      title: string;
      nodes: string[];
      relationships: string[];
      caption: string;
    };
  };
};

function buildChemistryVisual(question: string, answer: string): ChemistryVisualPayload {
  // Select the diagram from the learner's actual question only.
  // The generated answer may mention atoms/electrons while explaining orbitals;
  // it must never override the topic that the learner requested.
  const q = question.toLocaleLowerCase("uz-UZ").replace(/₂/g, "2").replace(/₃/g, "3");

  if (["orbital", "orbitallar", "orbita", "orbitall", "electron orbital"].some((term) => q.includes(term))) {
    return {
      kind: "orbital",
      title: "Orbita va orbital — farqi nimada?",
      subtitle: "Orbita — eski Bor modelida elektron uchun chizilgan soddalashtirilgan yo‘l. Orbital esa elektronni topish ehtimoli katta bo‘lgan fazo sohasi; u aniq aylana yo‘l emas. s-orbital shar, p-orbital esa gantelga o‘xshaydi.",
    };
  }

  if (q.includes("nacl") || q.includes("osh tuzi") || q.includes("natriy xlorid")) {
    return {
      kind: "molecule",
      title: "Osh tuzi tarkibi",
      formula: "NaCl",
      atoms: ["Na", "Cl"],
      subtitle: "Natriy xlorid natriy va xlor ionlaridan tuzilgan. Bu rasm ionli birikma tarkibini soddalashtirib ko‘rsatadi.",
    };
  }
  if (q.includes("suv hosil") || (q.includes("vodorod") && q.includes("kislorod") && q.includes("reaksiya"))) {
    return {
      kind: "reaction",
      title: "Suv hosil bo‘lish reaksiyasi",
      equation: "2H₂ + O₂ → 2H₂O",
      subtitle: "Tenglama muvozanatlangan: chap va o‘ng tomonda 4 ta vodorod atomi hamda 2 ta kislorod atomi bor.",
    };
  }
  if (q.includes("h2o") || q.includes("suv molekul") || q.includes("suvning tarkib")) {
    return {
      kind: "molecule",
      title: "Suv molekulasi",
      formula: "H₂O",
      atoms: ["H", "O", "H"],
      subtitle: "Suv molekulasi 2 ta vodorod (H) va 1 ta kislorod (O) atomidan tuzilgan.",
    };
  }
  if (q.includes("co2") || q.includes("karbonat angidrid")) {
    return {
      kind: "molecule",
      title: "Karbonat angidrid molekulasi",
      formula: "CO₂",
      atoms: ["O", "C", "O"],
      subtitle: "CO₂ molekulasida 1 ta uglerod va 2 ta kislorod atomi bor.",
    };
  }
  if (["proton", "neytron", "elektron", "atom", "yadro"].some((term) => q.includes(term))) {
    return {
      kind: "atom",
      title: "Atom ichki tuzilishi",
      subtitle: "Misol: geliy atomida 2 proton va 2 neytron yadroda, 2 elektron esa yadro atrofida joylashadi. Chizma soddalashtirilgan modeldir.",
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
    const uploadedImage: unknown = input.imageDataUrl;
    if (typeof uploadedImage !== "string") {
      return NextResponse.json({ error: "Rasm JPG, PNG yoki WEBP formatida bo‘lishi kerak." }, { status: 400 });
    }
    const allowedImagePrefixes = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"];
    const imagePrefix = allowedImagePrefixes.find((prefix) => uploadedImage.startsWith(prefix));
    const imagePayload = imagePrefix ? uploadedImage.slice(imagePrefix.length) : "";
    const isValidBase64 = imagePayload.length > 0 && Array.from(imagePayload).every((character) =>
      (character >= "A" && character <= "Z") ||
      (character >= "a" && character <= "z") ||
      (character >= "0" && character <= "9") || character === "+" || character === "/" || character === "="
    );
    if (!imagePrefix || !isValidBase64) {
      return NextResponse.json({ error: "Rasm JPG, PNG yoki WEBP formatida bo‘lishi kerak." }, { status: 400 });
    }
    if (uploadedImage.length > 4_200_000) {
      return NextResponse.json({ error: "Rasm hajmi 3 MB dan oshmasin." }, { status: 413 });
    }
    imageDataUrl = uploadedImage;
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
    ? " Kimyo fanida quruq uzun matn yozma: qisqa, qiziqarli tushuntirish, kundalik hayotdan o‘xshatish va bitta tekshiruv savoli ber. Xavfli moddalar bilan uyda tajriba buyurma. Mavzularni aralashtirma: savol proton/neytron haqida bo‘lsa atom tuzilishini, orbital haqida bo‘lsa orbital shakllarini tushuntir. ‘Orbita’ va ‘orbital’ bir xil emas: orbita eski Bor modelidagi soddalashtirilgan yo‘l; orbital elektronni topish ehtimoli katta bo‘lgan fazo sohasi. Orbitalni aylana yo‘l deb tasvirlama. s-orbital shar, p-orbital gantel shaklida bo‘lishini tushuntir."
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
      instructions: `Sen IJOD EDU maktab platformasining shaxsiy AI ustozisan. O‘quvchi sinfi: ${grade}. Fan: ${subject}. Tabiiy, sodda va to‘g‘ri o‘zbek tilida tushuntir; ingliz tili fanida inglizcha misollar va o‘zbekcha izoh ber. Mehribon, sabrli bo‘l va bolaning yoshiga mos so‘zlardan foydalan.

SENING JAVOBING IKKI QISM BO‘LSIN:
1) answer — chatda o‘quvchi o‘qiydigan qisqa va qiziqarli izoh. Savolni bevosita tushuntir, kerak bo‘lsa kundalik hayotdan misol keltir. Uzun devor-matn yozma.
2) board — doskaga qo‘yiladigan alohida dars materiali. HAR BIR FAN VA HAR BIR DARS SAVOLI UCHUN to‘ldir. Doska chat javobini takrorlamasin: mavzu sarlavhasi, mazmunli izoh, 2–5 ta mantiqiy qadam, kerakli formula/qoida, yechilgan misol, xulosa va bitta tekshiruv savolini yoz. Formula yoki misol kerak bo‘lmasa bo‘sh satr qaytar; to‘qima.

DIAGRAM QOIDASI: Chizma mavzuni yaxshiroq tushuntirsa, diagram.kind ni flow, timeline, comparison yoki concept_map qilib nodes va relationships ni to‘ldir. Chizma kerak bo‘lmasa none bo‘lsin. Matematikada yechim bosqichlari, sonlar o‘qi yoki grafik; fizikada kuchlar va harakat sxemasi; kimyoda atom, molekula yoki reaksiya; biologiyada organ yoki tizim; tarixda vaqt chizig‘i; geografiyada hudud yoki tabiiy jarayon; tillarda gap tuzilishi; informatikada algoritm ketma-ketligini ko‘rsat. Chizma aynan savolga mos bo‘lsin, bezak uchun umumiy sxema tuzma.

FAN QOIDALARI: Matematik/fizik masalalarda hisobni bosqichma-bosqich va birliklar bilan yech. Kimyoda formula va reaksiyalarni tekshir, orbital va orbitani aralashtirma. Tarixda sana va sabab-oqibatni, geografiyada joylashuv va jarayonni, biologiyada tuzilish va vazifani aniq tushuntir. Tillar fanida qoida va misol, adabiyotda matn tahlili, informatikada algoritm yoki kod bo‘lagini izohla. O‘quvchi xato qilsa, koyima — xatosini muloyim ko‘rsatib to‘g‘ri yo‘lni tushuntir. Bilmagan faktni to‘qima.

Salomlashuvga oddiy salom qaytar va doska uchun dars materiali yaratma. Tushunarsiz belgilar bo‘lsa, savolni qayta yozishni so‘ra. Dars savolida esa board ning barcha kerakli maydonlarini to‘ldir. ${sourceGuidance}${chemistryGuidance}${imageGuidance}`,
      text: {
        format: {
          type: "json_schema",
          name: "edu_tutor_lesson",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              answer: { type: "string" },
              board: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  explanation: { type: "string" },
                  steps: { type: "array", items: { type: "string" } },
                  formula: { type: "string" },
                  example: { type: "string" },
                  summary: { type: "string" },
                  checkQuestion: { type: "string" },
                  diagram: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      kind: { type: "string", enum: ["none", "flow", "timeline", "comparison", "concept_map"] },
                      title: { type: "string" },
                      nodes: { type: "array", items: { type: "string" } },
                      relationships: { type: "array", items: { type: "string" } },
                      caption: { type: "string" }
                    },
                    required: ["kind", "title", "nodes", "relationships", "caption"]
                  }
                },
                required: ["title", "explanation", "steps", "formula", "example", "summary", "checkQuestion", "diagram"]
              }
            },
            required: ["answer", "board"]
          }
        }
      },
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
      max_output_tokens: 2600,
    });
    await recordAiUsage(service, { userId: user.id, requestId, feature: "IJOD EDU · AI Ustoz", model: "gpt-6-luna", usage: response.usage });
    const outputMessageText = response.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content)
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join("\\n")
      .trim();
    const structuredText = response.output_text?.trim() || outputMessageText;
    if (response.status === "incomplete" || !structuredText) {
      throw new Error("AI dars javobi to‘liq kelmadi. Iltimos, yana bir marta yubor.");
    }
    let lesson: TutorStructuredResponse;
    try {
      lesson = JSON.parse(structuredText) as TutorStructuredResponse;
    } catch {
      throw new Error("AI dars javobini doska formatiga keltira olmadi. Qayta urinib ko‘ring.");
    }
    const text = typeof lesson.answer === "string" ? lesson.answer.trim() : "";
    const board = lesson.board;
    const whiteboard = buildEduLiveWhiteboard(board);
    if (!text || !board || typeof board.title !== "string" || !Array.isArray(board.steps) || !board.diagram) {
      throw new Error("AI dars javobida chat yoki doska ma’lumoti yetishmayapti.");
    if (!validateEduLiveWhiteboard(whiteboard)) throw new Error("Doska chizmasi xavfsiz formatdan o‘tmadi.");
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
      board,
      whiteboard,
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
