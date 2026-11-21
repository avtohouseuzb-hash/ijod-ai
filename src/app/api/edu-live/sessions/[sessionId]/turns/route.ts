import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getEduLiveStudentContext } from "@/lib/edu-live/server";
import { recordAiUsage } from "@/lib/ai-usage";
import { validateWhiteboardPayload } from "@/lib/edu-live/whiteboard-dsl";
import type { EduLiveBoardPayload, EduWhiteboardCommand } from "@/lib/edu-live/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
type RouteContext = { params: Promise<{ sessionId: string }> };
type LessonBoard = {
  title: string; explanation: string; steps: string[]; formula: string; example: string;
  summary: string; checkQuestion: string;
  diagram: { kind: "none" | "flow" | "timeline" | "comparison" | "concept_map"; title: string; nodes: string[]; relationships: string[]; caption: string };
};
type LessonResponse = { answer: string; board: LessonBoard };

const responseSchema = {
  type: "object", additionalProperties: false,
  properties: {
    answer: { type: "string" },
    board: { type: "object", additionalProperties: false, properties: {
      title: { type: "string" }, explanation: { type: "string" },
      steps: { type: "array", items: { type: "string" } }, formula: { type: "string" },
      example: { type: "string" }, summary: { type: "string" }, checkQuestion: { type: "string" },
      diagram: { type: "object", additionalProperties: false, properties: {
        kind: { type: "string", enum: ["none", "flow", "timeline", "comparison", "concept_map"] },
        title: { type: "string" }, nodes: { type: "array", items: { type: "string" } },
        relationships: { type: "array", items: { type: "string" } }, caption: { type: "string" },
      }, required: ["kind","title","nodes","relationships","caption"] },
    }, required: ["title","explanation","steps","formula","example","summary","checkQuestion","diagram"] },
  },
  required: ["answer","board"],
} as const;

function makeWhiteboard(board: LessonBoard): EduLiveBoardPayload {
  const commands: EduWhiteboardCommand[] = [
    { id: "clear", type: "clear" },
    { id: "title", type: "title", text: board.title.slice(0, 100), color: "#6d28d9" },
  ];
  const lines = board.explanation.trim().split(/\s+/);
  let line = "", lineNo = 0;
  for (const word of lines) {
    const next = line ? line + " " + word : word;
    if (next.length > 64 && line) {
      commands.push({ id: `explanation-${lineNo}`, type: "text", x: 50, y: 120 + lineNo * 34, text: line, fontSize: 22, color: "#1e293b" });
      lineNo++; line = word;
      if (lineNo >= 3) break;
    } else line = next;
  }
  if (line && lineNo < 3) commands.push({ id: `explanation-${lineNo}`, type: "text", x: 50, y: 120 + lineNo * 34, text: line, fontSize: 22, color: "#1e293b" });

  board.steps.slice(0, 4).forEach((step, index) => {
    const text = step.length > 104 ? step.slice(0, 101) + "…" : step;
    commands.push({ id: `step-${index+1}`, type: "text", x: 55, y: 245 + index * 48, text: `${index+1}. ${text}`, fontSize: 18, color: "#334155" });
  });

  const nodes = board.diagram.nodes.slice(0, 4);
  if (nodes.length) {
    const gap = 16, width = Math.floor((900 - gap * (nodes.length-1)) / nodes.length), y = 470;
    nodes.forEach((node,index) => {
      const x = 50 + index * (width + gap);
      commands.push({ id: `node-box-${index}`, type: "shape", shape: "rect", x, y, width, height: 58, stroke: "#0369a1", fill: "#f0f9ff", strokeWidth: 2 });
      commands.push({ id: `node-label-${index}`, type: "text", x: x+8, y: y+34, text: node.slice(0,32), fontSize: 16, color: "#0369a1" });
      if (index < nodes.length-1) commands.push({ id: `node-arrow-${index}`, type: "shape", shape: "arrow", x: x+width, y: y+29, width: gap, height: 0, stroke: "#6d28d9", strokeWidth: 2 });
    });
  }
  if (board.formula) commands.push({ id: "formula", type: "formula", x: 50, y: 620, expression: board.formula.slice(0, 100), color: "#6d28d9" });
  else if (board.summary) commands.push({ id: "summary", type: "text", x: 50, y: 620, text: ("Xulosa: " + board.summary).slice(0, 110), color: "#047857", fontSize: 19 });
  commands.push({ id: "finish", type: "finish" });
  return { version: 1, width: 1000, height: 700, commands };
}

export async function POST(request: Request, context: RouteContext) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI xizmati serverda sozlanmagan." }, { status: 503 });
  const student = await getEduLiveStudentContext(request);
  if (!student.ok) return NextResponse.json({ error: student.message }, { status: student.status });
  const { sessionId } = await context.params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Savol ma’lumoti noto‘g‘ri." }, { status: 400 });
  const input = body as { message?: unknown; imageDataUrl?: unknown };
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message || message.length > 2000) return NextResponse.json({ error: "Savol 1–2000 belgi bo‘lishi kerak." }, { status: 400 });

  const { data: session, error: sessionError } = await student.service.from("edu_live_sessions")
    .select("id,subject,grade,topic,status").eq("id", sessionId).eq("user_id", student.user.id).maybeSingle();
  if (sessionError) return NextResponse.json({ error: "Dars sessiyasini tekshirishda xatolik." }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Dars topilmadi." }, { status: 404 });
  if (session.status !== "active") return NextResponse.json({ error: "Bu dars hozir faol emas." }, { status: 409 });

  let imageDataUrl: string | null = null;
  if (input.imageDataUrl !== undefined && input.imageDataUrl !== null && input.imageDataUrl !== "") {
    if (typeof input.imageDataUrl !== "string") return NextResponse.json({ error: "Rasm formati noto‘g‘ri." }, { status: 400 });
    const match = input.imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || input.imageDataUrl.length > 4_200_000) return NextResponse.json({ error: "JPG, PNG yoki WEBP rasm 3 MB dan kichik bo‘lishi kerak." }, { status: 413 });
    imageDataUrl = input.imageDataUrl;
  }

  const { data: historyRows, error: historyError } = await student.service.from("edu_live_turns")
    .select("role,content").eq("session_id", sessionId).eq("user_id", student.user.id)
    .order("sequence", { ascending: false }).limit(10);
  if (historyError) return NextResponse.json({ error: "Dars tarixini yuklab bo‘lmadi." }, { status: 500 });
  const history = (historyRows ?? []).reverse().map((turn) => ({
    role: turn.role === "student" ? "user" as const : "assistant" as const, content: turn.content.slice(0,1800),
  }));

  const { data: collection } = await student.service.from("edu_textbook_collections")
    .select("openai_vector_store_id").eq("grade", session.grade).eq("subject", session.subject).maybeSingle();
  const vectorStoreId = collection?.openai_vector_store_id as string | null;
  const { count: readyBookCount } = await student.service.from("edu_textbooks")
    .select("id", { count: "exact", head: true }).eq("grade", session.grade).eq("subject", session.subject).eq("status", "ready");
  const useTextbook = Boolean(vectorStoreId && readyBookCount);

  const requestId = crypto.randomUUID();
  const { error: reserveError } = await student.service.rpc("reserve_credit_for_user", { p_user_id: student.user.id, p_request_id: requestId });
  if (reserveError) {
    if (reserveError.message.includes("Insufficient credits")) return NextResponse.json({ error: "Kreditingiz tugagan. Hisobingizni to‘ldiring." }, { status: 402 });
    console.error("EDU Live credit reservation failed:", reserveError.message);
    return NextResponse.json({ error: "Kredit tekshiruvida xatolik yuz berdi." }, { status: 500 });
  }

  let reserved = true;
  try {
    const response = await openai.responses.create({
      model: "gpt-6-luna",
      instructions: `Sen IJOD EDU Live Classroom shaxsiy ustozisan. Sinf: ${session.grade}-sinf. Fan: ${session.subject}. Mavzu: ${session.topic || "savolga qarab aniqlanadi"}. O‘zbek tilida sodda, qisqa, samimiy va yoshga mos tushuntir. answer — chatdagi tabiiy javob; board — doskadagi alohida dars rejasi. 2–5 qadam, kerakli formula/qoida, real misol, xulosa va bitta tekshiruv savoli ber. Keraksiz formula yoki misolni bo‘sh qoldir; to‘qima. Diagram faqat savolga mos bo‘lsa nodes/relationships bilan to‘ldir. Kimyoda orbitani orbital bilan aralashtirma; xavfli uy tajribasini tavsiya qilma. ${useTextbook ? "Indekslangan aynan shu darslikdan foydalan, sahifa raqamini faqat manba tasdiqlasa ayt." : "Rasmiy PDF indekslanmagan; darslik sahifasi yoki mashq raqamini to‘qima."}`,
      text: { format: { type: "json_schema", name: "edu_live_lesson", strict: true, schema: responseSchema } },
      input: [
        ...history,
        { role: "user" as const, content: [
          { type: "input_text" as const, text: `Sinf: ${session.grade}-sinf. Fan: ${session.subject}. Savol: ${message}` },
          ...(imageDataUrl ? [{ type: "input_image" as const, image_url: imageDataUrl, detail: "auto" as const }] : []),
        ]},
      ],
      ...(useTextbook ? { tools: [{ type: "file_search" as const, vector_store_ids: [vectorStoreId as string], max_num_results: 5 }], include: ["file_search_call.results" as const] } : {}),
      max_output_tokens: 2800,
    });
    await recordAiUsage(student.service,{userId:student.user.id,requestId,feature:"IJOD EDU · Live Classroom",model:"gpt-6-luna",sessionId,modality:imageDataUrl?"multimodal":"text",usage:response.usage});
    const raw = response.output_text?.trim();
    if (response.status === "incomplete" || !raw) throw new Error("AI dars javobi to‘liq kelmadi.");
    const lesson = JSON.parse(raw) as LessonResponse;
    if (!lesson.answer?.trim() || !lesson.board?.title || !Array.isArray(lesson.board.steps) || !lesson.board.diagram) throw new Error("AI dars javobida ma’lumot yetishmayapti.");

    const board = makeWhiteboard(lesson.board);
    const validation = validateWhiteboardPayload(board);
    if (!validation.ok) throw new Error(validation.error);

    const { data: saved, error: saveError } = await student.service.rpc("save_edu_live_exchange",{
      p_session_id:sessionId,p_user_id:student.user.id,p_student_content:message,p_tutor_content:lesson.answer.trim(),
      p_modality:imageDataUrl?"multimodal":"text",p_lesson_payload:{board:lesson.board,sourceMode:useTextbook?"textbook":"general"},
      p_board_commands:validation.payload.commands,
    });
    if (saveError || !saved?.length) throw new Error("Dars javobi saqlanmadi. Qayta urinib ko‘ring.");
    reserved = false;
    return NextResponse.json({sessionId,answer:lesson.answer.trim(),board:lesson.board,whiteboard:validation.payload,turns:saved[0],sourceMode:useTextbook?"textbook":"general"});
  } catch (error) {
    if (reserved) {
      const {error:refundError}=await student.service.rpc("refund_credit",{p_user_id:student.user.id,p_request_id:requestId,p_reason:"edu_live_lesson_failed"});
      if (refundError) console.error("EDU Live refund failed:",refundError.message);
    }
    console.error("EDU Live tutor error:",error instanceof Error?error.message:error);
    return NextResponse.json({error:"AI Ustoz darsni tayyorlay olmadi. Birozdan keyin qayta urinib ko‘ring."},{status:502});
  }
}
