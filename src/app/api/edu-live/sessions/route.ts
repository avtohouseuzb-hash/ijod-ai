import { NextResponse } from "next/server";
import { getEduLiveStudentContext } from "@/lib/edu-live/server";

export async function GET(request: Request) {
  const context = await getEduLiveStudentContext(request);
  if (!context.ok) return NextResponse.json({ error: context.message }, { status: context.status });

  const { data, error } = await context.service
    .from("edu_live_sessions")
    .select("id,subject,grade,topic,mode,status,started_at,ended_at,created_at")
    .eq("user_id", context.user.id)
    .order("started_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("EDU Live sessions list failed:", error.message);
    return NextResponse.json({ error: "Darslar tarixini yuklab bo‘lmadi." }, { status: 500 });
  }
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: Request) {
  const context = await getEduLiveStudentContext(request);
  if (!context.ok) return NextResponse.json({ error: context.message }, { status: context.status });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Dars ma’lumotlari noto‘g‘ri." }, { status: 400 });
  }
  const input = body as { subject?: unknown; topic?: unknown; mode?: unknown };
  const subject = typeof input.subject === "string" ? input.subject.trim().slice(0, 80) : "";
  const topic = typeof input.topic === "string" ? input.topic.trim().slice(0, 240) : "";
  const mode = input.mode === "voice" ? "voice" : input.mode === undefined || input.mode === "guided" ? "guided" : null;

  if (subject.length < 2) return NextResponse.json({ error: "Dars fanini tanlang." }, { status: 400 });
  if (!mode) return NextResponse.json({ error: "Dars rejimi noto‘g‘ri." }, { status: 400 });

  const { data, error } = await context.service
    .from("edu_live_sessions")
    .insert({ user_id: context.user.id, grade: context.grade, subject, topic, mode, status: "active", metadata: { source: "edu_live_classroom_v1" } })
    .select("id,subject,grade,topic,mode,status,started_at,ended_at,created_at")
    .single();

  if (error || !data) {
    console.error("EDU Live session create failed:", error?.message);
    return NextResponse.json({ error: "Dars sessiyasini boshlash imkoni bo‘lmadi." }, { status: 500 });
  }
  // Creating a lesson session never reserves or spends user credits.
  return NextResponse.json({ session: data, creditsCharged: false }, { status: 201 });
}
