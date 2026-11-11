import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const subjects = new Set(["Matematika", "Fizika", "Kimyo", "Biologiya", "Ingliz tili", "Tarix", "Ona tili", "Geografiya"]);

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
  const subject = typeof input.subject === "string" && subjects.has(input.subject) ? input.subject : "Matematika";
  const grade = typeof input.grade === "string" && /^(?:[1-9]|10|11)-sinf$/.test(input.grade) ? input.grade : "7-sinf";
  const history = Array.isArray(input.history)
    ? input.history.slice(-10).filter((item): item is { role: "user" | "assistant"; content: string } =>
        !!item && typeof item === "object" &&
        ["user", "assistant"].includes(String((item as { role?: unknown }).role)) &&
        typeof (item as { content?: unknown }).content === "string"
      ).map(item => ({ role: item.role, content: item.content.slice(0, 1800) }))
    : [];

  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: textbookSettings } = await service.from("edu_textbook_settings").select("openai_vector_store_id").eq("id", true).maybeSingle();
  const vectorStoreId = textbookSettings?.openai_vector_store_id as string | null;
  const { count: textbookCount } = await service.from("edu_textbooks").select("id", { count: "exact", head: true }).eq("grade", Number(grade.split("-")[0])).eq("subject", subject).eq("status", "ready");
  if (!vectorStoreId || !textbookCount) return NextResponse.json({ error: grade + " uchun " + subject + " darsliklari hali yuklanmagan." }, { status: 409 });

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
      instructions: "Sen IJOD EDU maktab platformasining shaxsiy AI ustozisan. O‘quvchi sinfi: " + grade + ". Fan: " + subject + ". Javobni avvalo File Search orqali topilgan aynan shu sinf va fan uchun yuklangan darsliklarga tayangan holda ber. Boshqa sinf yoki fan darsligini ishlatma. Darslikda topilmagan ma’lumotni darslikdan olingandek ko‘rsatma. Tegishli manba topilmasa, buni ochiq ayt. Manba nomi, bob va sahifani faqat qidiruv natijasida mavjud bo‘lsa ko‘rsat; sahifa raqamini taxmin qilma. Sodda o‘zbek tilida, yoshga mos tushuntir. O‘quvchini tayyor javob bilan cheklama: bosqichma-bosqich o‘rgat, oxirida kichik savol ber. Doskaga yozayotgandek MAVZU, 1-qadam, 2-qadam, XULOSA va ENDI SEN satrlaridan foydalan.",
      input: [
        ...history.map(item => ({ role: item.role, content: item.content })),
        { role: "user", content: "Sinf: " + grade + ". Fan: " + subject + ". Savol: " + input.message.trim() + ". Faqat shu sinf va fan darsligidan qidir." },
      ],
      tools: [{ type: "file_search", vector_store_ids: [vectorStoreId], max_num_results: 5 }],
      include: ["file_search_call.results"],
      max_output_tokens: 850,
    });
    const text = response.output_text?.trim();
    if (!text) throw new Error("AI bo‘sh javob qaytardi.");
    reserved = false;
    return NextResponse.json({ text });
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
