import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const subjects = new Set(["Matematika", "Fizika", "Kimyo", "Biologiya", "Ingliz tili", "Tarix", "Ona tili", "Geografiya"]);

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
  const subject = typeof input.subject === "string" && subjects.has(input.subject) ? input.subject : "";
  const taskTitle = typeof input.taskTitle === "string" ? input.taskTitle.trim().slice(0, 500) : "";
  if (!subject || !taskTitle) return NextResponse.json({ error: "Sinf, fan va topshiriq matnini kiriting." }, { status: 400 });
  if (typeof input.imageDataUrl !== "string") return NextResponse.json({ error: "Bajarilgan ish rasmini yuklang." }, { status: 400 });
  const match = input.imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return NextResponse.json({ error: "Faqat JPG, PNG yoki WEBP rasm yuklang." }, { status: 400 });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return NextResponse.json({ error: "Rasm hajmi 8 MB dan oshmasin." }, { status: 400 });

  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const vectorSettings = await service.from("edu_textbook_settings").select("openai_vector_store_id").eq("id", true).maybeSingle();
  const vectorStoreId = vectorSettings.data?.openai_vector_store_id as string | null;
  const { count } = await service.from("edu_textbooks").select("id", { count: "exact", head: true }).eq("grade", Number(grade.split("-")[0])).eq("subject", subject).eq("status", "ready");
  if (!vectorStoreId || !count) return NextResponse.json({ error: grade + " uchun " + subject + " darsliklari hali yuklanmagan." }, { status: 409 });

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
      instructions: "Sen IJOD EDU maktab o‘qituvchisisan. O‘quvchi sinfi: " + grade + ". Fan: " + subject + ". Vazifa: " + taskTitle + ". Avval File Search orqali aynan shu sinf va fan darsliklaridan topshiriq sharti yoki shu mavzudagi tegishli qoida va yechimni top. Keyin yuborilgan rasmda o‘quvchining yechimini tekshir. Faqat rasmda aniq ko‘ringan dalillarga tayan. Agar darslikdan tegishli topshiriq yoki qoida topilmasa, yoki rasmda shart/yechim o‘qilmasa, status unclear qaytar; taxmin bilan tasdiqlama. Javob to‘liq va to‘g‘ri bo‘lsa approved. Xato yoki tugallanmagan bo‘lsa needs_revision va xatoni sodda qilib tushuntir. O‘zbek tilida faqat JSON qaytar: {"status":"approved"|"needs_revision"|"unclear","feedback":"qisqa tushuntirish","score":0-100}.",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Sinf: " + grade + ". Fan: " + subject + ". Darslikdagi topshiriq: " + taskTitle + ". Rasmni darslikka tayangan holda tekshir." },
          { type: "input_image", image_url: input.imageDataUrl, detail: "auto" },
        ],
      }],
      tools: [{ type: "file_search", vector_store_ids: [vectorStoreId], max_num_results: 5 }],
      include: ["file_search_call.results"],
      max_output_tokens: 450,
    });
    const raw = response.output_text?.trim() || "";
    const parsed = JSON.parse(raw.replace(/^json\s*/i, ""));
    if (!["approved", "needs_revision", "unclear"].includes(parsed.status) || typeof parsed.feedback !== "string") throw new Error("AI tekshiruv javobi noto‘g‘ri formatda.");
    return NextResponse.json({ status: parsed.status, passed: parsed.status === "approved", feedback: parsed.feedback.slice(0, 1000), score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0 });
  } catch (error) {
    const { error: refundError } = await service.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "edu_homework_check_failed" });
    if (refundError) console.error("Homework check credit refund failed:", refundError.message);
    console.error("Homework AI check failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "AI rasmni darslik bilan solishtirib tekshira olmadi. Qayta urinib ko‘ring; muvaffaqiyatsiz so‘rov krediti qaytariladi." }, { status: 502 });
  }
}
