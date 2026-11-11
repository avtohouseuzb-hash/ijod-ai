import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const allowedTasks = new Set(["Kvadrat tenglamalar", "Present Perfect", "Hujayra tuzilishi"]);

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
  if (typeof input.taskTitle !== "string" || !allowedTasks.has(input.taskTitle)) return NextResponse.json({ error: "Vazifa topilmadi." }, { status: 400 });
  if (typeof input.imageDataUrl !== "string") return NextResponse.json({ error: "Vazifa rasmini yuklang." }, { status: 400 });
  const match = input.imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return NextResponse.json({ error: "Faqat JPG, PNG yoki WEBP rasm yuklang." }, { status: 400 });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return NextResponse.json({ error: "Rasm hajmi 8 MB dan oshmasin." }, { status: 400 });

  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = crypto.randomUUID();
  const { error: reserveError } = await service.rpc("reserve_credit_for_user", { p_user_id: user.id, p_request_id: requestId });
  if (reserveError) {
    if (reserveError.message.includes("Insufficient credits")) return NextResponse.json({ error: "Kreditingiz yetarli emas. Hisobingizni to‘ldiring." }, { status: 402 });
    console.error("Homework check credit reservation failed:", reserveError.message);
    return NextResponse.json({ error: "Kreditni tekshirishda xatolik yuz berdi." }, { status: 500 });
  }

  try {
    const grade = typeof input.grade === "string" ? input.grade : "7-sinf";
    const subject = typeof input.subject === "string" ? input.subject : "Maktab fani";
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      instructions: "Sen IJOD EDU maktab o‘quvchilarining uy vazifalarini tekshiruvchi AI o‘qituvchisan. O‘quvchi sinfi: " + grade + ". Fan: " + subject + ". Rasmni sinchiklab ko‘r. Vazifa nomi: " + input.taskTitle + ". Faqat rasmda aniq ko‘rinib turgan dalillarga tayan. Avval topshiriq sharti va o‘quvchi yechimi/javobi ko‘rinadimi, o‘qiladimi, bajarilganmi tekshir. Agar asl savol yoki misol sharti ko‘rinmasa, javobni ishonchli tekshirib bo‘lmaydi: approved bermagin; unclear qaytarib, shart ham tushadigan to‘liqroq rasm so‘ra. Agar rasm xira, kesilgan yoki boshqa vazifaga tegishli bo‘lsa, unclear qaytar. Agar yechim to‘liq emas yoki xato bo‘lsa, needs_revision qaytar va xatoni muloyim tushuntir. Faqat vazifa sharti va yechim yetarli darajada ko‘rinib, javoblar to‘g‘ri va vazifa bajarilgan bo‘lsa approved qaytar. Ingliz tilidagi vazifada grammatikani tekshir. Hech qachon taxmin bilan tasdiqlama. Javobni o‘zbek tilida yoz. Faqat JSON qaytar: {\"status\":\"approved\"|\"needs_revision\"|\"unclear\",\"feedback\":\"o‘quvchiga qisqa va aniq izoh\",\"score\":0-100}.",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Quyidagi rasmda " + input.taskTitle + " uy vazifasini tekshir. Vazifa sharti va barcha javoblarni ko‘rib chiq." },
          { type: "input_image", image_url: input.imageDataUrl },
        ],
      }],
      max_output_tokens: 350,
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
