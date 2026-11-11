import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const bucket = "edu-textbooks";
const subjects = new Set(["Matematika", "Fizika", "Kimyo", "Biologiya", "Ingliz tili", "Tarix", "Ona tili", "Geografiya"]);

async function getAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !anon || !secret) return { error: "Kirish yoki server sozlamalari topilmadi.", status: 401 as const };
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user) return { error: "Sessiya tugagan. Qayta kiring.", status: 401 as const };
  const allowed = (process.env.EDU_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !user.email || !allowed.includes(user.email.toLowerCase())) return { error: "Darslik yuklash faqat administrator uchun.", status: 403 as const };
  return { service: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }), user };
}

export async function GET(request: Request) {
  const auth = await getAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.service.from("edu_textbooks")
    .select("id,title,grade,subject,language,edition,publisher,status,error_message,created_at")
    .order("grade").order("subject").order("title");
  if (error) return NextResponse.json({ error: "Darsliklar ro‘yxatini olishda xatolik." }, { status: 500 });
  return NextResponse.json({ textbooks: data || [] });
}

export async function POST(request: Request) {
  const auth = await getAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 180) : "";
  const grade = Number(input.grade);
  const subject = typeof input.subject === "string" ? input.subject : "";
  const fileName = typeof input.fileName === "string" ? input.fileName.trim() : "";
  if (!title || !Number.isInteger(grade) || grade < 1 || grade > 11 || !subjects.has(subject)) return NextResponse.json({ error: "Darslik nomi, sinf va fan to‘g‘ri ko‘rsatilishi kerak." }, { status: 400 });
  if (!fileName.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "Faqat PDF darslik yuklash mumkin." }, { status: 400 });
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const id = crypto.randomUUID();
  const path = grade + "/" + subject.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "/" + id + "-" + safeName;
  const { data: signed, error: signError } = await auth.service.storage.from(bucket).createSignedUploadUrl(path);
  if (signError || !signed) return NextResponse.json({ error: "Darslik uchun yuklash havolasini yaratib bo‘lmadi." }, { status: 500 });
  const { error: insertError } = await auth.service.from("edu_textbooks").insert({
    id, title, grade, subject,
    language: typeof input.language === "string" ? input.language.slice(0, 20) : "uz-Latn",
    edition: typeof input.edition === "string" ? input.edition.slice(0, 80) : null,
    publisher: typeof input.publisher === "string" ? input.publisher.slice(0, 120) : null,
    storage_path: path, status: "upload_pending", uploaded_by: auth.user.id,
  });
  if (insertError) return NextResponse.json({ error: "Darslik ma’lumotlarini saqlab bo‘lmadi." }, { status: 500 });
  return NextResponse.json({ textbookId: id, path, token: signed.token });
}
