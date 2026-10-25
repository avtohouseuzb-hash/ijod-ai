import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const api = "https://api.replicate.com/v1";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!token) return fail("Video AI servisi ulanmagan: REPLICATE_API_TOKEN sozlanishi kerak.", 503);
  const bearer = request.headers.get("authorization") || "";
  const accessToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!accessToken) return fail("Avval hisobingizga kiring.", 401);
  if (!url || !anon || !secret) return fail("Server sozlamalari to‘liq emas.", 500);
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(accessToken);
  if (authError || !user) return fail("Sessiya tugagan. Qayta kiring.", 401);
  let body: any;
  try { body = await request.json(); } catch { return fail("So‘rov formati noto‘g‘ri."); }
  const { taskId, phase, requestId, audioUrl } = body || {};
  if (typeof taskId !== "string" || !/^[a-zA-Z0-9_-]{5,100}$/.test(taskId) || typeof requestId !== "string") return fail("Video vazifasi topilmadi.");
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const res = await fetch(`${api}/predictions/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const task = await res.json();
    if (!res.ok) throw new Error(task.detail || "Video holatini tekshirib bo‘lmadi.");
    if (task.status === "failed" || task.status === "canceled") {
      const { error: refundError } = await admin.rpc("refund_credit", { p_user_id: user.id, p_request_id: requestId, p_reason: "ai_video_generation_failed" });
      return fail(refundError ? "Video yaratilmadi, kreditni qaytarishda xatolik yuz berdi." : "Video yaratilmadi. Kredit qaytarildi. Qayta urinib ko‘ring.", 502);
    }
    if (task.status !== "succeeded") return NextResponse.json({ status: task.status || "processing" });
    if (phase === "prepare_lipsync") {
      if (typeof audioUrl !== "string" || typeof task.output !== "string") throw new Error("Lab moslash uchun video yoki audio topilmadi.");
      const lip = await fetch(`${api}/models/sync/lipsync-2/predictions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: { video: task.output, audio: audioUrl, sync_mode: "loop", temperature: 0.5, active_speaker: false } }),
      });
      const lipTask = await lip.json();
      if (!lip.ok) throw new Error(lipTask.detail || "Lab harakatini moslash servisi xatolik berdi.");
      return NextResponse.json({ status: "processing", taskId: lipTask.id, phase: "lipsync" });
    }
    const output = typeof task.output === "string" ? task.output : Array.isArray(task.output) && typeof task.output[0] === "string" ? task.output[0] : null;
    if (!output) throw new Error("Video tayyor, ammo natija havolasi topilmadi.");
    const { data: profile } = await admin.from("profiles").select("credits").eq("user_id", user.id).maybeSingle();
    return NextResponse.json({ status: "succeeded", videoUrl: output, remainingCredits: profile?.credits ?? null });
  } catch (error) {
    console.error("AI video status error:", error instanceof Error ? error.message : error);
    return fail(error instanceof Error ? error.message : "Video holatini tekshirib bo‘lmadi.", 502);
  }
}
