import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

type RouteContext = { params: Promise<{ sessionId: string }> };
type SessionStatus = "active" | "paused" | "completed" | "abandoned";

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
    .select("role,grade")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (roleError) return { ok: false as const, response: jsonError("O‘quvchi profilini tekshirishda xatolik.", 500) };
  if (!role || role.role !== "student") return { ok: false as const, response: jsonError("Ruxsat berilmadi.", 403) };

  return { ok: true as const, user: authData.user, service };
}

export async function GET(request: Request, context: RouteContext) {
  const student = await getStudent(request);
  if (!student.ok) return student.response;
  const { sessionId } = await context.params;

  const { data, error } = await student.service
    .from("edu_live_sessions")
    .select("id,subject,grade,topic,mode,status,started_at,ended_at,created_at,updated_at")
    .eq("id", sessionId)
    .eq("user_id", student.user.id)
    .maybeSingle();

  if (error) {
    console.error("EDU Live session load failed:", error.message);
    return jsonError("Dars sessiyasini yuklab bo‘lmadi.", 500);
  }
  if (!data) return jsonError("Dars topilmadi.", 404);
  return NextResponse.json({ session: data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const student = await getStudent(request);
  if (!student.ok) return student.response;
  const { sessionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Dars holati noto‘g‘ri.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Dars holati noto‘g‘ri.", 400);
  }

  const requestedStatus = (body as { status?: unknown }).status;
  const allowedStatuses: SessionStatus[] = ["active", "paused", "completed", "abandoned"];
  if (typeof requestedStatus !== "string" || !allowedStatuses.includes(requestedStatus as SessionStatus)) {
    return jsonError("Dars holati ruxsat etilmagan.", 400);
  }
  const status = requestedStatus as SessionStatus;
  const ended = status === "completed" || status === "abandoned";

  const { data, error } = await student.service
    .from("edu_live_sessions")
    .update({
      status,
      ended_at: ended ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", student.user.id)
    .select("id,status,ended_at,updated_at")
    .maybeSingle();

  if (error) {
    console.error("EDU Live session update failed:", error.message);
    return jsonError("Dars holatini saqlab bo‘lmadi.", 500);
  }
  if (!data) return jsonError("Dars topilmadi.", 404);
  return NextResponse.json({ session: data });
}
