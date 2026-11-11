import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
  if (!allowed.length || !user.email || !allowed.includes(user.email.toLowerCase())) return { error: "Darslik indekslash faqat administrator uchun.", status: 403 as const };
  if (!process.env.OPENAI_API_KEY) return { error: "OpenAI server kaliti sozlanmagan.", status: 503 as const };
  return { service: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

export async function POST(request: Request) {
  const auth = await getAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  const id = body && typeof body === "object" ? (body as { textbookId?: unknown }).textbookId : null;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Darslik identifikatori noto‘g‘ri." }, { status: 400 });

  const { data: textbook, error: findError } = await auth.service.from("edu_textbooks").select("*").eq("id", id).single();
  if (findError || !textbook) return NextResponse.json({ error: "Darslik topilmadi." }, { status: 404 });
  const { data: blob, error: downloadError } = await auth.service.storage.from("edu-textbooks").download(textbook.storage_path);
  if (downloadError || !blob) return NextResponse.json({ error: "Yuklangan PDF topilmadi. Avval faylni yuklang." }, { status: 409 });

  try {
    await auth.service.from("edu_textbooks").update({ status: "indexing", error_message: null }).eq("id", id);
    const { data: settings } = await auth.service.from("edu_textbook_settings").select("openai_vector_store_id").eq("id", true).maybeSingle();
    let vectorStoreId = settings?.openai_vector_store_id as string | null;
    if (!vectorStoreId) {
      const store = await openai.vectorStores.create({ name: "IJOD EDU — O‘zbekiston maktab darsliklari" });
      vectorStoreId = store.id;
      const { error: saveError } = await auth.service.from("edu_textbook_settings").upsert({ id: true, openai_vector_store_id: vectorStoreId, updated_at: new Date().toISOString() });
      if (saveError) throw new Error("Vector Store identifikatorini saqlab bo‘lmadi.");
    }
    const arrayBuffer = await blob.arrayBuffer();
    const file = new File([arrayBuffer], textbook.title + ".pdf", { type: "application/pdf" });
    const indexed = await openai.vectorStores.files.uploadAndPoll(vectorStoreId, file, { pollIntervalMs: 1200 });
    if (indexed.status !== "completed") throw new Error(indexed.last_error?.message || "PDF indekslash yakunlanmadi.");
    const { error: updateError } = await auth.service.from("edu_textbooks").update({
      openai_file_id: indexed.id, vector_store_id: vectorStoreId, status: "ready",
      error_message: null, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) throw new Error("Indekslangan darslik holatini saqlab bo‘lmadi.");
    return NextResponse.json({ ok: true, status: "ready", title: textbook.title });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Noma’lum indekslash xatosi.";
    await auth.service.from("edu_textbooks").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", id);
    console.error("IJOD EDU textbook indexing failed:", message);
    return NextResponse.json({ error: "Darslikni indekslashda xatolik: " + message }, { status: 502 });
  }
}
