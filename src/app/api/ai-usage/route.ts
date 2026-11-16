import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "") ?? "";
  if (!accessToken) return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secretKey) {
    return NextResponse.json({ error: "Supabase server sozlamalari to‘liq emas." }, { status: 500 });
  }

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  const service = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const tashkentNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const tashkentMidnightUtc = new Date(Date.UTC(
    tashkentNow.getUTCFullYear(),
    tashkentNow.getUTCMonth(),
    tashkentNow.getUTCDate(),
    -5,
  ));
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: events, error }, { data: settings, error: settingsError }] = await Promise.all([
    service.from("ai_usage_events")
      .select("id,feature,model,input_tokens,output_tokens,total_tokens,usage_available,created_at")
      .eq("user_id", user.id)
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false })
      .limit(2000),
    service.from("ai_runtime_settings").select("credit_test_mode").eq("id", true).maybeSingle(),
  ]);

  if (error) {
    console.error("AI usage history read failed:", error.message);
    return NextResponse.json({ error: "Token statistikasini yuklab bo‘lmadi." }, { status: 500 });
  }
  if (settingsError) console.error("AI runtime settings read failed:", settingsError.message);

  const rows = events ?? [];
  const today = rows.filter((event) => event.created_at >= tashkentMidnightUtc.toISOString());
  const summarise = (items: typeof rows) => ({
    calls: items.length,
    meteredCalls: items.filter((event) => event.usage_available).length,
    unmeteredCalls: items.filter((event) => !event.usage_available).length,
    inputTokens: items.reduce((sum, event) => sum + (event.input_tokens ?? 0), 0),
    outputTokens: items.reduce((sum, event) => sum + (event.output_tokens ?? 0), 0),
    totalTokens: items.reduce((sum, event) => sum + (event.total_tokens ?? 0), 0),
  });

  return NextResponse.json({
    creditTestMode: settings?.credit_test_mode ?? true,
    timezone: "Asia/Tashkent",
    today: summarise(today),
    last30Days: summarise(rows),
    recent: rows.slice(0, 30),
    truncated: rows.length === 2000,
  });
}
