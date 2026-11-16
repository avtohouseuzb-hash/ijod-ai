import OpenAI from "openai";
import { recordAiUsage } from "@/lib/ai-usage";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const input = body as { message?: unknown; history?: unknown; subject?: unknown; grade?: unknown };
  if (typeof input.message !== "string" || !input.message.trim() || input.message.length > 2000) {
    return NextResponse.json({ error: "Savol 1–2000 belgi bo‘lishi kerak." }, { status: 400 });
  }
  const subject = typeof input.subject === "string" ? input.subject.trim().slice(0, 80) : "Matematika";
  if (!subject) return NextResponse.json({ error: "Fanni tanlang." }, { status: 400 });
  const grade = typeof input.grade === "string" && /^(?:[1-9]|10|11)-sinf$/.test(input.grade) ? input.grade : "7-sinf";
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
      instructions: `Sen IJOD EDU maktab platformasining shaxsiy AI ustozisan. O‘quvchi: ${grade}. Fan: ${subject}. Faqat tabiiy, sodda o‘zbek tilida tushuntir (ingliz tili fanida inglizcha misollar va o‘zbekcha izoh ber). Yoshga mos, mehribon, sabrli va qiziqarli bo‘l. O‘quvchini tayyor javob bilan cheklama: avval tushuntir, keyin kichik savol berib tushunganini tekshir. Sinf darajasidan murakkab termin ishlatma; yangi terminni darhol izohla. Matematik/fizik masalalarda yechimni bosqichma-bosqich, formulani va birliklarni ko‘rsat. Kimyo fanida reaksiyalar va elementlarni to‘g‘ri yoz. Tarix/geografiya/biologiyada sabab-oqibat va hayotiy misol keltir. Agar savol boshqa fanga tegishli bo‘lsa, muloyimlik bilan tegishli fanni tanlashni tavsiya qil. Bilmagan faktni to‘qima. Javobni doskada yozilayotgandek qisqa satrlarga ajrat: birinchi qatorda MAVZU: ..., keyin har bir qadamni yangi qatorda 1-qadam:, 2-qadam: ko‘rinishida yoz; kerak bo‘lsa formulani alohida satrga qo‘y; oxirida XULOSA: va ENDI SEN: bilan o‘quvchiga bitta kichik mashq yoki savol ber. Markdown sarlavhalari va ro‘yxat belgilarini haddan tashqari ishlatma. Odatda 100–180 so‘zdan oshirma; murakkab masalada zarur qadamlarni qoldirma. Faqat foydali, o‘rgatuvchi javob ber.${sourceGuidance}`,
      input: [
        ...history.map(item => ({ role: item.role, content: item.content })),
        { role: "user", content: "Sinf: " + grade + ". Fan: " + subject + ". Savol: " + input.message.trim() },
      ],
      ...(useTextbook ? { tools: [{ type: "file_search" as const, vector_store_ids: [vectorStoreId as string], max_num_results: 5 }], include: ["file_search_call.results" as const] } : {}),
      max_output_tokens: 850,
    });
    await recordAiUsage(service, { userId: user.id, requestId, feature: "IJOD EDU · AI Ustoz", model: "gpt-6-luna", usage: response.usage });
    const text = response.output_text?.trim();
    if (!text) throw new Error("AI bo‘sh javob qaytardi.");
    reserved = false;
    return NextResponse.json({ text, sourceMode: useTextbook ? "textbook" : "general" });
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
