import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isNewsCronOrAdminAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!await isNewsCronOrAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.NEWS_TELEGRAM_CHAT_ID;
  if (!url || !key || !token || !channel) {
    return NextResponse.json({ error: "Supabase yoki Telegram channel sozlamasi topilmadi." }, { status: 500 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  const slotKey = "20:06-currency-test";

  const { data: existing } = await db.from("news_daily_posts")
    .select("id,status").eq("post_date", dateParts).eq("slot_key", slotKey).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, skipped: "test already attempted", status: existing.status });
  }

  const { data: claim, error: claimError } = await db.from("news_daily_posts").insert({
    post_date: dateParts, slot_key: slotKey, post_type: "currency_test", status: "sending",
    recipients_total: 1, started_at: now.toISOString(), payload: { timezone: "Asia/Tashkent", test: true }
  }).select("id").single();
  if (claimError || !claim) {
    return NextResponse.json({ error: claimError?.message || "Could not claim one-time test" }, { status: 409 });
  }

  try {
    const response = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/", {
      cache: "no-store", signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error("Markaziy bank kurslari olinmadi: " + response.status);
    const rates = await response.json() as Array<{ Ccy: string; Rate: string; Nominal: string; Date: string; Diff?: string }>;
    const order = ["USD", "EUR", "RUB", "GBP", "JPY", "CHF", "CNY", "KZT", "TRY"];
    const selected = order.map(code => rates.find(rate => rate.Ccy === code)).filter(Boolean) as Array<{ Ccy: string; Rate: string; Nominal: string; Date: string; Diff?: string }>;
    if (selected.length < 7) throw new Error("Valyuta kurslari to‘liq kelmadi.");

    const previousDate = new Date(now.getTime() - 86400000);
    const previousDateText = previousDate.getFullYear() + "-" + String(previousDate.getMonth() + 1).padStart(2, "0") + "-" + String(previousDate.getDate()).padStart(2, "0");
    let previousMap = new Map<string, number>();
    try {
      const previousResponse = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/all/" + previousDateText + "/", {
        cache: "no-store", signal: AbortSignal.timeout(8000)
      });
      if (previousResponse.ok) {
        const previous = await previousResponse.json() as Array<{ Ccy: string; Rate: string }>;
        previousMap = new Map(previous.map(item => [item.Ccy, Number(item.Rate)]));
      }
    } catch (error) {
      console.warn("Previous currency rates unavailable", error);
    }

    const flags: Record<string, string> = { USD: "US", EUR: "EU", RUB: "RU", GBP: "GB", JPY: "JP", CHF: "CH", CNY: "CN", KZT: "KZ", TRY: "TR" };
    const imageRates = selected.map(item => {
      const rate = Number(item.Rate);
      const previous = previousMap.get(item.Ccy);
      return {
        code: item.Ccy, rate, nominal: Number(item.Nominal) || 1,
        diff: previous !== undefined && Number.isFinite(previous)
          ? Number((rate - previous).toFixed(2))
          : item.Diff !== undefined ? Number(item.Diff) : null,
        flag: flags[item.Ccy] || item.Ccy.slice(0, 2)
      };
    });

    const imageUrl = new URL("/api/news/currency-image", request.url);
    imageUrl.searchParams.set("date", selected[0].Date);
    imageUrl.searchParams.set("rates", JSON.stringify(imageRates));
    const imageResponse = await fetch(imageUrl, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!imageResponse.ok) throw new Error("Valyuta infografikasi yaratilmadi: " + imageResponse.status);
    const photo = Buffer.from(await imageResponse.arrayBuffer());

    const form = new FormData();
    form.append("chat_id", channel);
    form.append("caption", "🧪 TEST · IJOD AI valyuta kurslari · " + selected[0].Date);
    form.append("photo", new Blob([new Uint8Array(photo)], { type: "image/png" }), "ijod-currency-rates-test.png");
    const telegramResponse = await fetch("https://api.telegram.org/bot" + token + "/sendPhoto", {
      method: "POST", body: form, signal: AbortSignal.timeout(20000)
    });
    const telegramResult = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok || !telegramResult.ok) throw new Error(String(telegramResult.description || "Telegram sendPhoto failed"));

    await db.from("news_daily_posts").update({
      status: "sent", recipients_sent: 1,
      payload: { test: true, rateDate: selected[0].Date, rates: imageRates, imageFormat: "png" },
      sent_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq("id", claim.id);
    return NextResponse.json({ ok: true, sent: 1, destination: "channel", rateDate: selected[0].Date, rateCount: imageRates.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Currency test failed";
    await db.from("news_daily_posts").update({ status: "failed", error: message, updated_at: new Date().toISOString() }).eq("id", claim.id);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
