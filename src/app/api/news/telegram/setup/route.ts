import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.NEWS_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !site) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN yoki NEXT_PUBLIC_SITE_URL sozlanmagan." }, { status: 500 });
  const webhookUrl = site.replace(/\/$/, "") + "/api/news/telegram/webhook";
  const payload: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  };
  if (webhookSecret) payload.secret_token = webhookSecret;
  const response = await fetch("https://api.telegram.org/bot" + token + "/setWebhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    console.error("Telegram webhook setup failed", result);
    return NextResponse.json({ error: "Telegram webhook sozlanmadi.", details: result.description || "Telegram API error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, webhookUrl, description: result.description || "Webhook configured" });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.NEWS_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN sozlanmagan." }, { status: 500 });
  const response = await fetch("https://api.telegram.org/bot" + token + "/getWebhookInfo");
  const result = await response.json();
  return NextResponse.json(result);
}
