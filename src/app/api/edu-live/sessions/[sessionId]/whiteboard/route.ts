import { NextResponse } from "next/server";
import { getEduLiveStudentContext } from "@/lib/edu-live/server";
import { validateWhiteboardPayload } from "@/lib/edu-live/whiteboard-dsl";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const student = await getEduLiveStudentContext(request);
  if (!student.ok) return NextResponse.json({ error: student.message }, { status: student.status });
  const { sessionId } = await context.params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Doska ma’lumoti noto‘g‘ri." }, { status: 400 }); }

  const validated = validateWhiteboardPayload(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { data: session, error: sessionError } = await student.service
    .from("edu_live_sessions")
    .select("id,status")
    .eq("id", sessionId)
    .eq("user_id", student.user.id)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ error: "Dars sessiyasini tekshirishda xatolik." }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Dars topilmadi." }, { status: 404 });
  if (session.status !== "active" && session.status !== "paused") {
    return NextResponse.json({ error: "Yakunlangan dars doskasini o‘zgartirib bo‘lmaydi." }, { status: 409 });
  }

  const rows = validated.payload.commands.map((command) => ({
    session_id: sessionId,
    user_id: student.user.id,
    command,
    playback_ms: command.delayMs ?? 0,
  }));
  if (!rows.length) return NextResponse.json({ saved: 0 });

  const { data, error } = await student.service
    .from("edu_live_whiteboard_events")
    .insert(rows)
    .select("id,sequence,command,playback_ms,created_at");

  if (error) {
    console.error("EDU Live whiteboard save failed:", error.message);
    return NextResponse.json({ error: "Doska chizmasini saqlab bo‘lmadi." }, { status: 500 });
  }

  return NextResponse.json({ saved: data?.length ?? 0, events: data ?? [] }, { status: 201 });
}
