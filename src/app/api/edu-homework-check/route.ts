import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI tekshiruv xizmati sozlanmagan." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!token) return NextResponse.json({ error: "Davom etish uchun hisobingizga kiring." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) return NextResponse.json({ error: "Supabase server sozlamalari to‘liq emas." }, { status: 500 });

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as { taskTitle?: unknown; subject?: unknown; grade?: unknown; imageDataUrl?: unknown } : {};
  const grade = typeof input.grade === "string" && /^(?:[1-9]|10|11)-sinf$/.test(input.grade) ? input.grade : "7-sinf";
  const subject = typeof input.subject === "string" ? input.subject.trim().slice(0, 80) : "";
  const taskTitle = typeof input.taskTitle === "string" ? input.taskTitle.trim().slice(0, 500) : "";
  if (!subject || !taskTitle) return NextResponse.json({ error: "Sinf, fan va topshiriq matnini kiriting." }, { status: 400 });
  if (typeof input.imageDataUrl !== "string") return NextResponse.json({ error: "Bajarilgan ish rasmini yuklang." }, { status: 400 });
  const match = input.imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return NextResponse.json({ error: "Faqat JPG, PNG yoki WEBP rasm yuklang." }, { status: 400 });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return NextResponse.json({ error: "Rasm hajmi 8 MB dan oshmasin." }, { status: 400 });

  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const gradeNumber = Number(grade.split("-")[0]);
  const { data: collection } = await service.from("edu_textbook_collections")
    .select("openai_vector_store_id").eq("grade", gradeNumber).eq("subject", subject).maybeSingle();
  const vectorStoreId = collection?.openai_vector_store_id as string | null;
  const { count: readyBookCount } = await service.from("edu_textbooks")
    .select("id", { count: "exact", head: true }).eq("grade", gradeNumber).eq("subject", subject).eq("status", "ready");
  const useTextbook = Boolean(vectorStoreId && readyBookCount);
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await service.rpc("reserve_credit_for_user", { p_user_id: user.id, p_request_id: requestId });
  if (reserveError) {
    if (reserveError.message.includes("Insufficient credits")) return NextResponse.json({ error: "Kreditingiz yetarli emas. Hisobingizni to‘ldiring." }, { status: 402 });
    console.error("Homework check credit reservation failed:", reserveError.message);
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik yuz berdi." }, { status: 500 });
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      instructions: "Sen IJOD EDU maktab o‘qituvchisisan. O‘quvchi sinfi: " + grade + ". Fan: " + subject + ". Vazifa: " + taskTitle + ". Rasmni sinchiklab ko‘r. Faqat ko‘rinib turgan dalillarga tayan. Agar rasmda savol sharti yoki yechim o‘qilmasa, unclear qaytar. Xato yoki tugallanmagan bo‘lsa needs_revision va sababini sodda tushuntir. Faqat shart va yechim yetarlicha ko‘rinsa, javob ishonchli tekshirilib to‘g‘ri bo‘lsa approved qaytar. Hech qachon taxmin bilan tasdiqlama. " + (useTextbook ? "File Search orqali aynan shu sinf va fan darsligidan tegishli qoida yoki topshiriqni ham izla. Kitob manbasi topilmasa, sahifa yoki mashq raqamini aytma. " : "Hozircha rasmiy darslik indekslanmagan. Umumiy fan bilimlari bilan tekshir, lekin darslikdagi sahifa yoki mashq raqamini to‘qima. ") + "O‘zbek tilida faqat JSON qaytar: {\"status\":\"approved\"|\"needs_revision\"|\"unclear\",\"feedback\":\"o‘quvchiga qisqa va aniq izoh\",\"score\":0-100}.",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Sinf: " + grade + ". Fan: " + subject + ". Topshiriq: " + taskTitle + ". Rasmni tekshir." },
          { type: "input_image", image_url: input.imageDataUrl, detail: "auto" },
        ],
      }],
      ...(useTextbook ? { tools: [{ type: "file_search" as const, vector_store_ids: [vectorStoreId as string], max_num_results: 5 }], include: ["file_search_call.results" as const] } : {}),
      max_output_tokens: 450,
    });
    const raw = response.output_text?.trim() || "";
    const parsed = JSON.parse(raw.replace(/^json\s*/i, ""));
    if (!["approved", "needs_revision", "unclear"].includes(parsed.status) || typeof parsed.feedback !== "string") throw new Error("AI tekshiruv javobi noto‘g‘ri formatda.");
    const score = Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
    return NextResponse.json({ status: parsed.status, passed: parsed.status === "approved", feedback: parsed.feedback.slice(0, 1000), score });
  } catch (error) {
    const { error: refundError } = await service.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "edu_homework_check_failed" });
    if (refundError) console.error("Homework check credit refund failed:", refundError.message);
    console.error("Homework AI check failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "AI rasmni tekshira olmadi. Iltimos, tiniqroq rasm bilan qayta urinib ko‘ring. Xatolik yuz bergan so‘rov krediti qaytariladi." }, { status: 502 });
  }
}
