import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getStudent(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
    return { ok: false as const, response: jsonError("Server sozlamalari to‘liq emas.", 500) };
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false as const, response: jsonError("Hisobingizga qayta kiring.", 401) };

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { ok: false as const, response: jsonError("Sessiya tugagan. Qayta kiring.", 401) };
  }

  const service = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: role, error: roleError } = await service
    .from("edu_user_roles")
    .select("role,grade,display_name")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (roleError) {
    console.error("EDU Live role lookup failed:", roleError.message);
    return { ok: false as const, response: jsonError("O‘quvchi profilini tekshirib bo‘lmadi.", 500) };
  }
  if (!role || role.role !== "student") {
    return { ok: false as const, response: jsonError("Live Classroom faqat o‘quvchi profili uchun.", 403) };
  }
  if (!Number.isInteger(role.grade) || role.grade < 1 || role.grade > 11) {
    return { ok: false as const, response: jsonError("O‘quvchi sinfi profilida to‘g‘ri saqlanmagan.", 409) };
  }

  return { ok: true as const, user: authData.user, service, grade: role.grade as number };
}

export async function GET(request: Request) {
  const student = await getStudent(request);
  if (!student.ok) return student.response;

  const { data, error } = await student.service
    .from("edu_live_sessions")
    .select("id,subject,grade,topic,mode,status,started_at,ended_at,created_at,updated_at")
    .eq("user_id", student.user.id)
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("EDU Live sessions list failed:", error.message);
    return jsonError("Darslar tarixini yuklab bo‘lmadi.", 500);
  }

  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: Request) {
  const student = await getStudent(request);
  if (!student.ok) return student.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("So‘rov formati noto‘g‘ri.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Dars ma’lumotlari noto‘g‘ri.", 400);
  }

  const input = body as { subject?: unknown; topic?: unknown; mode?: unknown };
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  const mode = input.mode === undefined ? "guided" : input.mode;

  if (subject.length < 2 || subject.length > 80) {
    return jsonError("Fan nomi 2–80 belgi oralig‘ida bo‘lishi kerak.", 400);
  }
  if (topic.length > 240) return jsonError("Mavzu nomi 240 belgidan oshmasligi kerak.", 400);
  if (mode !== "guided" && mode !== "voice") {
    return jsonError("Dars rejimi noto‘g‘ri.", 400);
  }

  const { data, error } = await student.service
    .from("edu_live_sessions")
    .insert({
      user_id: student.user.id,
      grade: student.grade,
      subject,
      topic,
      mode,
      status: "active",
      metadata: { source: "edu_live_classroom" },
    })
    .select("id,subject,grade,topic,mode,status,started_at,ended_at,created_at,updated_at")
    .single();

  if (error || !data) {
    console.error("EDU Live session create failed:", error?.message);
    return jsonError("Yangi darsni boshlash imkoni bo‘lmadi.", 500);
  }

  // Starting a lesson is not a billable AI request; no credits are reserved.
  return NextResponse.json({ session: data, creditsCharged: false }, { status: 201 });
}
