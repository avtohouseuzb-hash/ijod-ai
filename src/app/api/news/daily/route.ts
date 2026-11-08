import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isNewsCronAuthorized } from "@/lib/news-cron-auth";

export const maxDuration = 60;
const TZ = "Asia/Tashkent";
const NEWS_SLOTS = ["09:30","10:45","12:00","13:15","14:30","15:45","17:00","18:15","19:45","21:15"];
const DAILY_SCHEDULE = [
  { time: "08:00", type: "motivation" as const, windowMinutes: 15 },
  { time: "08:15", type: "weather" as const, windowMinutes: 15 },
  { time: "08:30", type: "currency" as const, windowMinutes: 15 },
  ...NEWS_SLOTS.map(time => ({ time, type: "news" as const, windowMinutes: 20 }))
];

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "long", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value])) as Record<string,string>;
}
function toCyrillic(input: string) {
  const pairs: Array<[string,string]> = [["o‘","ў"],["g‘","ғ"],["sh","ш"],["ch","ч"],["yo","ё"],["yu","ю"],["ya","я"],["ng","нг"],["a","а"],["b","б"],["d","д"],["e","е"],["f","ф"],["g","г"],["h","ҳ"],["i","и"],["j","ж"],["k","к"],["l","л"],["m","м"],["n","н"],["o","о"],["p","п"],["q","қ"],["r","р"],["s","с"],["t","т"],["u","у"],["v","в"],["x","х"],["y","й"],["z","з"],["c","ц"]];
  let value=input;
  for(const [latin,cyr] of pairs) value=value.replace(new RegExp(latin,"gi"),match=>match===match.toUpperCase()?cyr.toUpperCase():cyr);
  return value;
}
function localized(text: string, language: string) {
  return language==="uz-cyrl"
    ? text.split(/(<[^>]*>)/g).map(part => part.startsWith("<") ? part : toCyrillic(part)).join("")
    : text;
}
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
async function sendTelegram(token: string, chatId: string, text: string, parseMode?: "HTML") {
  const response = await fetch("https://api.telegram.org/bot"+token+"/sendMessage", {
    method:"POST", headers:{"content-type":"application/json"},
    body:JSON.stringify({chat_id:chatId,text,parse_mode:parseMode,disable_web_page_preview:true}),
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
  const currentMinute=Number(parts.hour)*60+Number(parts.minute);
  const requestedSlot=new URL(request.url).searchParams.get("slot");
  let selectedSlot: typeof DAILY_SCHEDULE[number] | undefined;
  if(requestedSlot){
    selectedSlot=DAILY_SCHEDULE.find(candidate=>candidate.time===requestedSlot);
  }
  for(const candidate of selectedSlot ? [] : DAILY_SCHEDULE){
    const [hour,minute]=candidate.time.split(":").map(Number);
    const age=currentMinute-(hour*60+minute);
    if(age<0||age>candidate.windowMinutes) continue;
    const {data:row}=await db.from("news_daily_posts").select("id,status,started_at").eq("post_date",today).eq("slot_key",candidate.time).maybeSingle();
    if(row?.status==="sent"||row?.status==="partial") continue;
    if(row?.status==="sending"&&row.started_at&&Date.now()-new Date(row.started_at).getTime()<5*60*1000) continue;
    selectedSlot=candidate;
    break;
  }
  if(!selectedSlot) return NextResponse.json({ok:true,skipped:"no due schedule slot",time:hhmm});
  const type=selectedSlot.type,slot=selectedSlot.time;
  const {data:existing}=await db.from("news_daily_posts").select("id,status,started_at").eq("post_date",today).eq("slot_key",slot).maybeSingle();
  if(existing&&(existing.status==="sent"||existing.status==="partial")) return NextResponse.json({ok:true,skipped:"slot already delivered",slot,status:existing.status});
  let postId:string;
  if(existing){
    const {data:updated,error:updateError}=await db.from("news_daily_posts").update({
      status:"sending",error:null,started_at:now.toISOString(),updated_at:now.toISOString(),
      recipients_total:recipients.length
    }).eq("id",existing.id).select("id").single();
    if(updateError||!updated) return NextResponse.json({ok:false,error:updateError?.message||"Could not claim schedule slot"},{status:500});
    postId=updated.id;
  }else{
    const {data:claimed,error:claimError}=await db.from("news_daily_posts").insert({
      post_date:today,slot_key:slot,post_type:type,status:"sending",
      recipients_total:recipients.length,started_at:now.toISOString(),payload:{timezone:TZ}
    }).select("id").single();
    if(claimError||!claimed) return NextResponse.json({ok:true,skipped:"slot already claimed or database error",detail:claimError?.message});
    postId=claimed.id;
  }
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
      const code=Number(current.weather_code);
      const captions=recipients.map(r=>({chatId:r.chatId,caption:localized(weatherText(r.language,city,current,daily),r.language)}));
      let weatherImage:Buffer|null=null;
      if(settings?.weather_image_enabled===true&&process.env.OPENAI_API_KEY){
        try{
          const prompt="Create a premium editorial weather illustration for "+city+", Uzbekistan, based on this real forecast: temperature "+Math.round(current.temperature_2m)+" Celsius, apparent temperature "+Math.round(current.apparent_temperature)+" Celsius, weather code "+code+", wind "+Math.round(current.wind_speed_10m)+" km/h, precipitation "+(daily.precipitation_sum?.[0]??0)+" mm. Visually communicate the actual weather condition. Beautiful cinematic atmospheric scene, polished modern digital illustration, rich natural detail, vertical 4:5 composition, no text, no letters, no numbers, no logos, no watermark.";
          const imageResponse=await fetch("https://api.openai.com/v1/images/generations",{
            method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+process.env.OPENAI_API_KEY},
            body:JSON.stringify({model:process.env.IJOD_WEATHER_IMAGE_MODEL||"gpt-image-2.5-sunburst",prompt,size:"1024x1536",quality:"low",output_format:"png"}),
            signal:AbortSignal.timeout(45000)
          });
          const imageJson=await imageResponse.json().catch(()=>({}));
          if(imageResponse.ok&&imageJson.data?.[0]?.b64_json) weatherImage=Buffer.from(imageJson.data[0].b64_json,"base64");
          else console.error("Weather image generation failed",imageJson.error?.message||imageResponse.status);
        }catch(imageError){console.error("Weather image generation failed",imageError);}
      }
      let sent=0,errors:string[]=[];
      for(const item of captions){
        try{
          if(weatherImage){
            const form=new FormData();
            form.append("chat_id",item.chatId);
            form.append("caption",item.caption.slice(0,1000));
            form.append("photo",new Blob([new Uint8Array(weatherImage)],{type:"image/png"}),"ijod-weather.png");
            const response=await fetch("https://api.telegram.org/bot"+token+"/sendPhoto",{method:"POST",body:form,signal:AbortSignal.timeout(15000)});
            const result=await response.json().catch(()=>({}));
            if(!response.ok||!result.ok) throw new Error(String(result.description||"Telegram sendPhoto failed"));
          }else await sendTelegram(token,item.chatId,item.caption);
          sent++;
        }catch(e){errors.push(item.chatId+": "+(e instanceof Error?e.message:"send failed"));}
      }
      payload={kind:type,city,current,daily,aiImageGenerated:Boolean(weatherImage)};
      await db.from("news_daily_posts").update({status:errors.length?(sent?"partial":"failed"):"sent",recipients_sent:sent,payload:{...payload,errors},sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",postId);
      return NextResponse.json({ok:!errors.length,type,slot,sent,city,weather:current,aiImageGenerated:Boolean(weatherImage),errors});
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
          ?"<b>💱 КУРС ВАЛЮТ ЦБ Узбекистана</b>\n\n<b>🇺🇸 1 USD = "+Number(usd.Rate).toLocaleString("ru-RU")+" сум</b>\n\n"+lines.join("\n")+"\n\nДата курса: "+usd.Date
          :localized("<b>💱 O‘ZBEKISTONDA VALYUTA KURSLARI</b>\n\n<b>🇺🇸 1 AQSh dollari (USD)\n"+Number(usd.Rate).toLocaleString("uz-UZ")+" SO‘M</b>\n\n"+lines.join("\n")+"\n\nManba: O‘zbekiston Markaziy banki · "+usd.Date,r.language);
        try{await sendTelegram(token,r.chatId,text,"HTML");sent++;}catch(e){errors.push(r.chatId+": "+(e instanceof Error?e.message:"send failed"));}
      }
      payload={kind:type,usd,otherRates:lines};
      await db.from("news_daily_posts").update({status:errors.length?(sent?"partial":"failed"):"sent",recipients_sent:sent,payload:{...payload,errors},sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",postId);
      return NextResponse.json({ok:!errors.length,type,slot,sent,usd:usd.Rate,errors});
    }
    const {data:state}=await db.from("news_pipeline_state").select("source_offset").eq("id",true).maybeSingle();
    const categoryParents:Record<string,string[]> = {
      "Huquq":["O‘zbekiston"],"O‘zbekiston":["O‘zbekiston"],"Jahon":["Jahon"],"AI va IT":["AI va IT"],"Biznes":["Biznes"],"Iqtisodiyot":["Iqtisodiyot"],"Fan":["Fan"],"Sport":["Sport"],
      "O‘zbekiston qonunchiligi":["O‘zbekiston"],"Xalqaro huquq":["Jahon"],"Sud va huquqiy amaliyot":["O‘zbekiston","Jahon"],"Normativ hujjatlar":["O‘zbekiston"],
      "Fizika":["Fan"],"Kimyo":["Fan"],"Matematika":["Fan"],"Biologiya":["Fan"],"Astronomiya":["Fan"],"Geologiya":["Fan"],"Ekologiya":["Fan"],
      "Sun’iy intellekt":["AI va IT"],"Dasturlash":["AI va IT"],"Kiberxavfsizlik":["AI va IT"],"Robototexnika":["AI va IT"],"IT kompaniyalar":["AI va IT","Biznes"],"Startap texnologiyalari":["AI va IT","Biznes"],
      "Davlat":["O‘zbekiston"],"Jamiyat":["O‘zbekiston"],"Hududlar":["O‘zbekiston"],"Ijtimoiy yangiliklar":["O‘zbekiston"],"Siyosat":["O‘zbekiston","Jahon"],
      "Jahon yangiliklari":["Jahon"],"Geosiyosat":["Jahon"],"Xalqaro munosabatlar":["Jahon"],"Davlatlar":["Jahon"],
      "Jahon iqtisodiyoti":["Iqtisodiyot"],"Bozorlar":["Iqtisodiyot"],"Savdo":["Iqtisodiyot"],"Sanoat":["Iqtisodiyot"],"Makroiqtisodiyot":["Iqtisodiyot"],
      "Bank":["Iqtisodiyot"],"Kredit":["Iqtisodiyot"],"Investitsiya":["Iqtisodiyot","Biznes"],"Soliq":["Iqtisodiyot"],"Sug‘urta":["Iqtisodiyot"],"Fintech":["Iqtisodiyot","AI va IT"],
      "Qurilish texnologiyalari":["Iqtisodiyot"],"Kadastr":["O‘zbekiston","Iqtisodiyot"],"Qurilish materiallari":["Iqtisodiyot"],"Me’yorlar":["O‘zbekiston"],
      "Uy-joy bozori":["Iqtisodiyot"],"Ijara":["Iqtisodiyot"],"Ipoteka":["Iqtisodiyot"],"Arxitektura":["Iqtisodiyot"],
      "Mebel":["Iqtisodiyot"],"Interyer":["Iqtisodiyot"],"Eksteryer":["Iqtisodiyot"],"Dizayn materiallari":["Iqtisodiyot"],
      "Avtomobil":["Iqtisodiyot"],"Maishiy texnika":["AI va IT"],"Ishlab chiqarish":["Iqtisodiyot"],"Transport":["Iqtisodiyot"],
      "Ta’lim texnologiyalari":["Fan"],"Yangi metodlar":["Fan"],"Ilmiy tadqiqotlar":["Fan"],"Oliy ta’lim":["Fan","O‘zbekiston"],
      "Tarix":["Jahon","O‘zbekiston"],"Kitoblar":["Jahon"],"Kino":["Jahon"],"San’at":["Jahon"],"Hajviya":["Jahon"],"Trendlar":["Jahon","AI va IT"],"Qiziqarli faktlar":["Fan","Jahon"],"Fantastika":["Jahon"],
      "Tadbirkorlik":["Biznes"],"Marketing":["Biznes"],"Menejment":["Biznes"],"Biznes yangiliklari":["Biznes"],
      "Tibbiyot":["Fan"],"Ilmiy izlanishlar":["Fan"],"Sog‘lom turmush":["Fan"]
    };
    const allowedCategories=["Iqtisodiyot","Fan","Jahon","AI va IT","O‘zbekiston","Biznes","Sport"];
    const selectedCategories=[...new Set(recipients.flatMap(r=>r.categories.flatMap(topic=>categoryParents[topic]||[])))].filter(category=>allowedCategories.includes(category));
    if(!selectedCategories.length) throw new Error("Faol obunachilar uchun tanlangan yangilik mavzulari topilmadi.");
    const {count:sourceCount}=await db.from("news_sources").select("id",{count:"exact",head:true}).eq("enabled",true).in("category",selectedCategories);
    let offset=Math.max(0,Number(state?.source_offset||0));
    if(offset>=Number(sourceCount||0)) offset=0;
    const headers={authorization:request.headers.get("authorization")||""};
    const batches:Array<{collect:any;processed:any;offset:number}>=[];
    let sent=0,found=false;
    for(let attempt=0;attempt<3;attempt++){
      const collectUrl=new URL(new URL(request.url).origin+"/api/news/collect");
      collectUrl.searchParams.set("offset",String(offset)); collectUrl.searchParams.set("limit","10");
      collectUrl.searchParams.set("categories",selectedCategories.join(","));
      const collectResponse=await fetch(collectUrl,{headers,cache:"no-store",signal:AbortSignal.timeout(25000)});
      const collect=await collectResponse.json().catch(()=>({error:"collect response invalid"}));
      if(!collectResponse.ok||collect.error) throw new Error("Manba yig‘ish xatosi: "+JSON.stringify(collect).slice(0,400));
      const nextOffset=Number(collect.nextOffset??offset);
      const hasMore=Boolean(collect.hasMore);
      const next=hasMore&&nextOffset<Number(sourceCount||0)?nextOffset:0;
      await db.from("news_pipeline_state").update({source_offset:next,last_collect_at:new Date().toISOString(),last_collect_result:collect,updated_at:new Date().toISOString()}).eq("id",true);
      const processResponse=await fetch(new URL(request.url).origin+"/api/news/process",{headers,cache:"no-store",signal:AbortSignal.timeout(25000)});
      const processed=await processResponse.json().catch(()=>({error:"process response invalid"}));
      if(!processResponse.ok||processed.error) throw new Error("Yangilikni tarjima/yuborish xatosi: "+JSON.stringify(processed).slice(0,400));
      batches.push({collect,processed,offset});
      sent=Number(processed.telegramMessagesSent||0);
      if(sent>0){found=true;break;}
      if(!hasMore&&next===0) break;
      offset=next;
    }
    payload={kind:type,batches,sourceOffset:offset};
    const status=found?"sent":"no_news";
    await db.from("news_daily_posts").update({status,recipients_sent:sent,payload,sent_at:found?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",postId);
    return NextResponse.json({ok:found,type,slot,sent,batchesTried:batches.length,newsFound:found});
  }catch(error){
    const message=error instanceof Error?error.message:"Daily news job failed";
    await db.from("news_daily_posts").update({status:"failed",error:message,updated_at:new Date().toISOString()}).eq("id",postId);
    return NextResponse.json({ok:false,type,slot,error:message},{status:500});
  }
}
export async function GET(request:Request){return run(request);}
export async function POST(request:Request){return run(request);}
