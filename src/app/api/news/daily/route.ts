import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isNewsCronAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 60;
const TZ = "Asia/Tashkent";
const NEWS_SLOTS = ["09:30","10:45","12:00","13:15","14:30","15:45","17:00","18:15","19:45","21:15"];

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "long", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value])) as Record<string,string>;
}
function toCyrillic(input: string) {
  const pairs: Array<[string,string]> = [["o‘","ў"],["g‘","ғ"],["sh","ш"],["ch","ч"],["yo","йў"],["yu","ю"],["ya","я"],["ng","нг"],["a","а"],["b","б"],["d","д"],["e","е"],["f","ф"],["g","г"],["h","ҳ"],["i","и"],["j","ж"],["k","к"],["l","л"],["m","м"],["n","н"],["o","о"],["p","п"],["q","қ"],["r","р"],["s","с"],["t","т"],["u","у"],["v","в"],["x","х"],["y","й"],["z","з"],["c","ц"]];
  let value=input;
  for(const [latin,cyr] of pairs) value=value.replace(new RegExp(latin,"gi"),match=>match===match.toUpperCase()?cyr.toUpperCase():cyr);
  return value;
}
function localized(text: string, language: string) { return language==="uz-cyrl" ? toCyrillic(text) : text; }
function season(month: number) {
  if ([12,1,2].includes(month)) return "qish";
  if ([3,4,5].includes(month)) return "bahor";
  if ([6,7,8].includes(month)) return "yoz";
  return "kuz";
}
function motivation(language: string, weekday: string, month: number, categories: string[]) {
  const interest = categories.slice(0,2).join(" va ");
  const dayUz: Record<string,string> = {Monday:"dushanba",Tuesday:"seshanba",Wednesday:"chorshanba",Thursday:"payshanba",Friday:"juma",Saturday:"shanba",Sunday:"yakshanba"};
  const dayRu: Record<string,string> = {Monday:"понедельник",Tuesday:"вторник",Wednesday:"среда",Thursday:"четверг",Friday:"пятница",Saturday:"суббота",Sunday:"воскресенье"};
  const seasonUz = season(month);
  if (language === "ru") return [
    "Доброе утро! ☀️ Пусть этот " + dayRu[weekday] + " станет днём ясных мыслей и одного важного шага к вашей цели.",
    "🍂 " + (seasonUz==="qish"?"Зимой":"В это время года") + " особенно важно беречь энергию. Начните спокойно — и сохраните свой темп.",
    "✨ Ваш интерес к теме «" + (interest || "новому") + "» может стать источником сегодняшней идеи. Заметьте её и действуйте!"
  ].join("\n\n");
  const day = dayUz[weekday] || "bugun";
  const seasonal = seasonUz==="qish" ? "Qishning sokin nafasi yangi rejalarga joy ochsin." : seasonUz==="bahor" ? "Bahor yangilanish fasli — bugun bitta yaxshi odatni boshlang." : seasonUz==="yoz" ? "Yozning yorug‘ energiyasini foydali ishga yo‘naltiring." : "Kuz — xulosalar va yangi maqsadlar uchun ajoyib fasl.";
  const quote = [
    "Katta natija har kuni bajarilgan kichik, ammo izchil qadamdan boshlanadi.",
    "Bugun o‘zingizga bitta va’da bering — kechqurun uni bajarganingizdan xursand bo‘ling.",
    "Mukammal vaqtni kutmang. Eng yaxshi boshlanish — hozirgi kichik harakat.",
    "O‘zingizni boshqalar bilan emas, kechagi o‘zingiz bilan solishtiring."
  ];
  const index = (month + weekday.length) % quote.length;
  return "Xayrli tong! ☀️\n\n" + seasonal + "\n\n💡 " + quote[index] + "\n\n✨ " + (interest ? "Bugungi kichik ilhom: " + interest + " bo‘yicha bitta yangi narsa o‘rganing." : "Bugun o‘zingiz uchun foydali bir qadam tashlang.") + "\n\nYaxshi kayfiyat va unumli " + day + " tilaymiz! 🌿";
}
function weatherText(language: string, city: string, current: any, daily: any) {
  const code = Number(current.weather_code);
  const icon = code===0?"☀️":code<=3?"⛅":code<=48?"🌫️":code<=67?"🌧️":code<=77?"❄️":code<=82?"🌦️":"⛈️";
  const condition = code===0?"ochiq":code<=3?"qisman bulutli":code<=48?"tumanli":code<=67?"yomg‘irli":code<=77?"qorli":code<=82?"yomg‘ir yog‘ishi mumkin":"momaqaldiroqli";
  if (language === "ru") return icon+" Погода в "+city+"\n\n🌡 Сейчас: "+Math.round(current.temperature_2m)+"°C (ощущается как "+Math.round(current.apparent_temperature)+"°C)\n📍 "+condition+"\n💨 Ветер: "+Math.round(current.wind_speed_10m)+" км/ч\n🌧 Осадки сегодня: "+(daily.precipitation_sum?.[0] ?? 0)+" мм\n\nПусть погода задаёт настроение, а не планы! 🌿";
  return icon+" Bugungi ob-havo — "+city+"\n\n🌡 Hozir: "+Math.round(current.temperature_2m)+"°C (his qilinishi "+Math.round(current.apparent_temperature)+"°C)\n📍 Holat: "+condition+"\n💨 Shamol: "+Math.round(current.wind_speed_10m)+" km/soat\n🌧 Bugungi yog‘ingarchilik: "+(daily.precipitation_sum?.[0] ?? 0)+" mm\n\nOb-havo qanday bo‘lishidan qat’i nazar, kuningiz chiroyli o‘tsin! 🌿";
}
async function sendTelegram(token: string, chatId: string, text: string) {
  const response = await fetch("https://api.telegram.org/bot"+token+"/sendMessage", {
    method:"POST", headers:{"content-type":"application/json"},
    body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true}),
    signal:AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(()=>({}));
  if (!response.ok || !result.ok) throw new Error(String(result.description || "Telegram send failed"));
}
async function run(request: Request) {
  if (!await isNewsCronAuthorized(request)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY, token=process.env.TELEGRAM_BOT_TOKEN;
  if(!url||!key||!token) return NextResponse.json({error:"Supabase yoki Telegram sozlamasi topilmadi."},{status:500});
  const db=createClient(url,key,{auth:{persistSession:false}});
  const now=new Date(), parts=localParts(now), today=parts.year+"-"+parts.month+"-"+parts.day, hhmm=parts.hour+":"+parts.minute;
  const {data:settings}=await db.from("news_daily_settings").select("*").eq("id",true).maybeSingle();
  if(settings?.enabled===false) return NextResponse.json({ok:true,skipped:"daily schedule disabled"});
  const {data:subs,error:subsError}=await db.from("news_telegram_subscriptions").select("chat_id,language,categories").eq("enabled",true);
  if(subsError) return NextResponse.json({error:subsError.message},{status:500});
  const recipients=(subs||[]).map(s=>({chatId:String(s.chat_id),language:String(s.language||"uz-latn"),categories:Array.isArray(s.categories)?s.categories:[]}));
  const channel=process.env.NEWS_TELEGRAM_CHAT_ID;
  const channelLanguage=process.env.NEWS_TELEGRAM_CHANNEL_LANGUAGE||"uz-latn";
  if(channel&&!recipients.some(r=>r.chatId===channel)) recipients.push({chatId:channel,language:channelLanguage,categories:[...new Set((subs||[]).flatMap(s=>s.categories||[]))]});
  if(!recipients.length) return NextResponse.json({ok:true,skipped:"no active Telegram recipients"});
  let type:"motivation"|"weather"|"currency"|"news"|null=null,slot=hhmm;
  if(hhmm==="08:00") type="motivation";
  else if(hhmm==="08:15") type="weather";
  else if(hhmm==="08:30") type="currency";
  else if(NEWS_SLOTS.includes(hhmm)) type="news";
  else return NextResponse.json({ok:true,skipped:"not a scheduled minute",time:hhmm});
  const {data:existing}=await db.from("news_daily_posts").select("id,status").eq("post_date",today).eq("slot_key",slot).maybeSingle();
  if(existing) return NextResponse.json({ok:true,skipped:"slot already claimed",slot,status:existing.status});
  const {data:claimed,error:claimError}=await db.from("news_daily_posts").insert({post_date:today,slot_key:slot,post_type:type,status:"sending",recipients_total:recipients.length,started_at:now.toISOString(),payload:{timezone:TZ}}).select("id").single();
  if(claimError||!claimed) return NextResponse.json({ok:true,skipped:"slot already claimed or database error",detail:claimError?.message});
  const postId=claimed.id;
  try {
    let payload:Record<string,unknown>={};
    if(type==="motivation"){
      const month=Number(parts.month);
      const messages=recipients.map(r=>({chatId:r.chatId,text:localized(motivation(r.language,parts.weekday,month,r.categories),r.language)}));
      payload={kind:type,weekday:parts.weekday,season:season(month)};
      let sent=0,errors:string[]=[];
      for(const m of messages){try{await sendTelegram(token,m.chatId,m.text);sent++;}catch(e){errors.push(m.chatId+": "+(e instanceof Error?e.message:"send failed"));}}
      await db.from("news_daily_posts").update({status:errors.length?(sent?"partial":"failed"):"sent",recipients_sent:sent,payload:{...payload,errors},sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",postId);
      return NextResponse.json({ok:!errors.length,type,slot,sent,errors});
    }
    if(type==="weather"){
      const city=String(settings?.city||"Tashkent"),lat=Number(settings?.latitude||41.2995),lon=Number(settings?.longitude||69.2401);
      const wx=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTashkent",{cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!wx.ok) throw new Error("Ob-havo xizmati javob bermadi: "+wx.status);
      const weather=await wx.json(), current=weather.current, daily=weather.daily;
      if(!current||!daily) throw new Error("Ob-havo ma’lumoti to‘liq emas.");
      let sent=0,errors:string[]=[];
      for(const r of recipients){try{await sendTelegram(token,r.chatId,localized(weatherText(r.language,city,current,daily),r.language));sent++;}catch(e){errors.push(r.chatId+": "+(e instanceof Error?e.message:"send failed"));}}
      payload={kind:type,city,current,daily,illustration:"weather emoji; AI image generation disabled to preserve free budget"};
      await db.from("news_daily_posts").update({status:errors.length?(sent?"partial":"failed"):"sent",recipients_sent:sent,payload:{...payload,errors},sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",postId);
      return NextResponse.json({ok:!errors.length,type,slot,sent,city,weather:current,aiImageGenerated:false,errors});
    }
    if(type==="currency"){
      const response=await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/",{cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error("Markaziy bank kurslari olinmadi: "+response.status);
      const rates=await response.json() as Array<{Ccy:string;Rate:string;Nominal:string;Date:string;CcyNm_UZ?:string}>;
      const usd=rates.find(r=>r.Ccy==="USD");
      if(!usd) throw new Error("USD kursi Markaziy bank javobida topilmadi.");
      const order=["EUR","RUB","GBP","CNY","KZT","TRY"];
      const lines=order.map(code=>rates.find(r=>r.Ccy===code)).filter(Boolean).map(r=>r!.Ccy+" — "+Number(r!.Rate).toLocaleString("uz-UZ")+" so‘m");
      let sent=0,errors:string[]=[];
      for(const r of recipients){
        const text=r.language==="ru"
          ?"💱 КУРС ВАЛЮТ ЦБ Узбекистана\\n\\n🇺🇸 1 USD = "+Number(usd.Rate).toLocaleString("ru-RU")+" сум\\n\\n"+lines.join("\\n")+"\\n\\nДата курса: "+usd.Date
          :localized("💱 O‘ZBEKISTONDA VALYUTA KURSLARI\\n\\n🇺🇸 1 AQSh dollari (USD)\\n"+Number(usd.Rate).toLocaleString("uz-UZ")+" SO‘M\\n\\n"+lines.join("\\n")+"\\n\\nManba: O‘zbekiston Markaziy banki · "+usd.Date,r.language);
        try{await sendTelegram(token,r.chatId,text);sent++;}catch(e){errors.push(r.chatId+": "+(e instanceof Error?e.message:"send failed"));}
      }
      payload={kind:type,usd,otherRates:lines};
      await db.from("news_daily_posts").update({status:errors.length?(sent?"partial":"failed"):"sent",recipients_sent:sent,payload:{...payload,errors},sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",postId);
      return NextResponse.json({ok:!errors.length,type,slot,sent,usd:usd.Rate,errors});
    }
    const {data:state}=await db.from("news_pipeline_state").select("source_offset").eq("id",true).maybeSingle();
    const {count:sourceCount}=await db.from("news_sources").select("id",{count:"exact",head:true}).eq("enabled",true);
    const offset=Math.max(0,Number(state?.source_offset||0));
    const collectUrl=new URL(new URL(request.url).origin+"/api/news/collect");
    collectUrl.searchParams.set("offset",String(offset)); collectUrl.searchParams.set("limit","10");
    const headers={authorization:request.headers.get("authorization")||""};
    const collectResponse=await fetch(collectUrl,{headers,cache:"no-store",signal:AbortSignal.timeout(50000)});
    const collect=await collectResponse.json().catch(()=>({error:"collect response invalid"}));
    if(!collectResponse.ok||collect.error) throw new Error("Manba yig‘ish xatosi: "+JSON.stringify(collect).slice(0,400));
    const nextOffset=Number(collect.nextOffset||offset),hasMore=Boolean(collect.hasMore);
    await db.from("news_pipeline_state").update({source_offset:hasMore&&nextOffset<Number(sourceCount||0)?nextOffset:0,last_collect_at:new Date().toISOString(),last_collect_result:collect,updated_at:new Date().toISOString()}).eq("id",true);
    const processResponse=await fetch(new URL(request.url).origin+"/api/news/process",{headers,cache:"no-store",signal:AbortSignal.timeout(50000)});
    const processed=await processResponse.json().catch(()=>({error:"process response invalid"}));
    if(!processResponse.ok||processed.error) throw new Error("Yangilikni tarjima/yuborish xatosi: "+JSON.stringify(processed).slice(0,400));
    payload={kind:type,collect,processed,sourceOffset:offset};
    const sent=Number(processed.telegramMessagesSent||0);
    const status=sent>0?"sent":Number(processed.processed||0)>0?"partial":"no_news";
    await db.from("news_daily_posts").update({status,recipients_sent:sent,payload,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",postId);
    return NextResponse.json({ok:true,type,slot,collect,processed});
  }catch(error){
    const message=error instanceof Error?error.message:"Daily news job failed";
    await db.from("news_daily_posts").update({status:"failed",error:message,updated_at:new Date().toISOString()}).eq("id",postId);
    return NextResponse.json({ok:false,type,slot,error:message},{status:500});
  }
}
export async function GET(request:Request){return run(request);}
export async function POST(request:Request){return run(request);}
