import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
async function isAdmin(request:Request){
 const bearer=request.headers.get("authorization")||"";const token=bearer.startsWith("Bearer ")?bearer.slice(7):"";
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const pub=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!token||!url||!pub)return false;
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 const emails=(process.env.AI_NEWS_ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase());
 return !error&&!!user?.email&&emails.includes(user.email.toLowerCase());
}
export async function POST(request:Request){
 if(!await isAdmin(request))return NextResponse.json({error:"Admin huquqi talab qilinadi."},{status:403});
 const token=process.env.TELEGRAM_BOT_TOKEN;const site="https://www.ijod-ai.uz";const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
 if(!token||!secret)return NextResponse.json({error:"TELEGRAM_BOT_TOKEN va TELEGRAM_WEBHOOK_SECRET sozlanishi shart."},{status:500});
 const webhookUrl=site.replace(/\/$/,"")+"/api/news/telegram/webhook";
 const payload:Record<string,unknown>={url:webhookUrl,allowed_updates:["message","callback_query"],drop_pending_updates:false};
 if(secret)payload.secret_token=secret;
 const response=await fetch("https://api.telegram.org/bot"+token+"/setWebhook",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
 const result=await response.json();
 if(!response.ok||!result.ok){console.error("Telegram webhook setup failed",result);return NextResponse.json({error:result.description||"Telegram webhook sozlanmadi."},{status:502});}
 const infoResponse=await fetch("https://api.telegram.org/bot"+token+"/getWebhookInfo");
 const info=await infoResponse.json();
 if(!infoResponse.ok||!info.ok){console.error("Telegram getWebhookInfo failed",info);return NextResponse.json({ok:true,webhookUrl,description:result.description||"Webhook configured",verificationWarning:info.description||"Webhook holatini tekshirib bo‘lmadi."});}
 const webhook=info.result||{};
 return NextResponse.json({ok:true,webhookUrl,description:result.description||"Webhook configured",verifiedUrl:webhook.url||null,pendingUpdateCount:webhook.pending_update_count??0,lastErrorDate:webhook.last_error_date??null,lastErrorMessage:webhook.last_error_message??null,allowedUpdates:webhook.allowed_updates??[]});
}
export async function GET(request:Request){
 if(!await isAdmin(request))return NextResponse.json({error:"Admin huquqi talab qilinadi."},{status:403});
 const token=process.env.TELEGRAM_BOT_TOKEN;if(!token)return NextResponse.json({error:"TELEGRAM_BOT_TOKEN sozlanmagan."},{status:500});
 const response=await fetch("https://api.telegram.org/bot"+token+"/getWebhookInfo");return NextResponse.json(await response.json());
}
