import { NextResponse } from "next/server";
import { getEduLiveStudentContext } from "@/lib/edu-live/server";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const student = await getEduLiveStudentContext(request);
  if (!student.ok) return NextResponse.json({ error: student.message }, { status: student.status });
  const { sessionId } = await context.params;

  const { data: session, error } = await student.service
    .from("edu_live_sessions")
    .select("id,subject,grade,topic,mode,status,started_at,ended_at,created_at")
    .eq("id", sessionId)
    .eq("user_id", student.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Dars sessiyasini yuklashda xatolik." }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Dars topilmadi." }, { status: 404 });

  const [turns, boardEvents, quizAttempts] = await Promise.all([
    student.service.from("edu_live_turns").select("id,sequence,role,modality,content,lesson_payload,source_refs,created_at").eq("session_id", sessionId).eq("user_id", student.user.id).order("sequence", { ascending: true }).limit(300),
    student.service.from("edu_live_whiteboard_events").select("id,turn_id,sequence,command,playback_ms,created_at").eq("session_id", sessionId).eq("user_id", student.user.id).order("sequence", { ascending: true }).limit(500),
    student.service.from("edu_live_quiz_attempts").select("id,turn_id,question_key,answer_payload,is_correct,score,feedback,attempt_number,created_at").eq("session_id", sessionId).eq("user_id", student.user.id).order("created_at", { ascending: true }).limit(200),
  ]);

  if (turns.error || boardEvents.error || quizAttempts.error) {
    console.error("EDU Live session data load failed:", turns.error?.message, boardEvents.error?.message, quizAttempts.error?.message);
    return NextResponse.json({ error: "Dars materiallarini yuklab bo‘lmadi." }, { status: 500 });
  }

  return NextResponse.json({ session, turns: turns.data ?? [], whiteboardEvents: boardEvents.data ?? [], quizAttempts: quizAttempts.data ?? [] });
}

export async function PATCH(request: Request, context: RouteContext) {
  const student = await getEduLiveStudentContext(request);
  if (!student.ok) return NextResponse.json({ error: student.message }, { status: student.status });
  const { sessionId } = await context.params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Sessiya holati noto‘g‘ri." }, { status: 400 });

  const status = (body as { status?: unknown }).status;
  if (!["paused", "completed", "abandoned", "active"].includes(String(status))) {
    return NextResponse.json({ error: "Dars holati noto‘g‘ri." }, { status: 400 });
  }
  const update = {
    status: status as "paused" | "completed" | "abandoned" | "active",
    ended_at: status === "completed" || status === "abandoned" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await student.service
    .from("edu_live_sessions").update(update)
    .eq("id", sessionId).eq("user_id", student.user.id)
    .select("id,status,ended_at,updated_at").maybeSingle();

  if (error) return NextResponse.json({ error: "Dars holatini saqlab bo‘lmadi." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Dars topilmadi." }, { status: 404 });
  return NextResponse.json({ session: data });
}
