import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization") || "";
  const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Hisobingizga kiring." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !serviceKey) return NextResponse.json({ error: "Server sozlamalari to‘liq emas." }, { status: 500 });
  const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Sessiya yaroqsiz. Qayta kiring." }, { status: 401 });
  let body: { chatId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  if (!/^-?\d{5,20}$/.test(chatId)) return NextResponse.json({ error: "Telegram chat ID noto‘g‘ri." }, { status: 400 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: subscription, error: lookupError } = await db.from("news_telegram_subscriptions").select("id,chat_id").eq("chat_id", chatId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Telegram obunasini tekshirib bo‘lmadi." }, { status: 500 });
  if (!subscription) return NextResponse.json({ error: "Avval @ijod_ai_bot botiga /start yuboring, keyin chat ID ni kiriting." }, { status: 404 });
  const { error: updateError } = await db.from("news_telegram_subscriptions").update({ user_id: user.id, updated_at: new Date().toISOString() }).eq("id", subscription.id);
  if (updateError) return NextResponse.json({ error: "Telegram hisobini ulab bo‘lmadi." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
