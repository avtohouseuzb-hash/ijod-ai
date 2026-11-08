"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
const topicGroups:Record<string,string[]>={
 "Huquq":["O‘zbekiston qonunchiligi","Xalqaro huquq","Sud va huquqiy amaliyot","Normativ hujjatlar"],
 "Fan":["Fizika","Kimyo","Matematika","Biologiya","Astronomiya","Geologiya","Ekologiya"],
 "AI va IT":["Sun’iy intellekt","Dasturlash","Kiberxavfsizlik","Robototexnika","IT kompaniyalar","Startap texnologiyalari"],
 "O‘zbekiston":["Davlat","Jamiyat","Hududlar","Ijtimoiy yangiliklar","Siyosat"],
 "Jahon":["Jahon yangiliklari","Geosiyosat","Xalqaro munosabatlar","Davlatlar"],
 "Iqtisodiyot":["Jahon iqtisodiyoti","Bozorlar","Savdo","Sanoat","Makroiqtisodiyot"],
 "Bank va moliya":["Bank","Kredit","Investitsiya","Soliq","Sug‘urta","Fintech"],
 "Qurilish":["Qurilish texnologiyalari","Kadastr","Qurilish materiallari","Me’yorlar"],
 "Ko‘chmas mulk":["Uy-joy bozori","Ijara","Ipoteka","Arxitektura"],
 "Mebel va dizayn":["Mebel","Interyer","Eksteryer","Dizayn materiallari"],
 "Texnika":["Avtomobil","Maishiy texnika","Ishlab chiqarish","Transport"],
 "Ta’lim":["Ta’lim texnologiyalari","Yangi metodlar","Ilmiy tadqiqotlar","Oliy ta’lim"],
 "Madaniyat":["Tarix","Kitoblar","Kino","San’at"],
 "Ko‘ngilochar":["Hajviya","Trendlar","Qiziqarli faktlar","Fantastika"],
 "Biznes":["Tadbirkorlik","Marketing","Menejment","Biznes yangiliklari"],
 "Salomatlik":["Tibbiyot","Ilmiy izlanishlar","Sog‘lom turmush"],
 "Sport":["Sport"]
};
const categories=Object.keys(topicGroups);
const allTopics=Object.values(topicGroups).flat();
const topicOptions=Object.entries(topicGroups).flatMap(([group,topics])=>topics.map(topic=>({group,topic})));
const sourceGroups=["RSS manbalari","Rasmiy davlat saytlari","Yangilik portallari","Xalqaro tashkilotlar","Ilmiy jurnallar va tadqiqotlar","Kompaniya va banklarning rasmiy yangiliklari","Normativ-huquqiy hujjatlar portallari","Administrator kiritgan maxsus URL"];
type Source={id:string;name:string;feed_url:string;site_url?:string|null;source_group?:string|null;connector_type?:string|null;category:string;enabled:boolean};
export default function NewsAdminPage(){
 const [sources,setSources]=useState<Source[]>([]);
 const [name,setName]=useState(""); const [feedUrl,setFeedUrl]=useState(""); const [category,setCategory]=useState(allTopics[0]); const [sourceGroup,setSourceGroup]=useState(sourceGroups[0]); const [siteUrl,setSiteUrl]=useState(""); const [editingId,setEditingId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [filterGroup,setFilterGroup]=useState("Barchasi"); const [filterTopic,setFilterTopic]=useState("Barchasi"); const [filterText,setFilterText]=useState(""); const [notice,setNotice]=useState(""); const [pipelineBusy,setPipelineBusy]=useState(false); const [pipelineResult,setPipelineResult]=useState<any>(null);
 async function call(method:"GET"|"POST",body?:unknown){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){setNotice("Avval IJOD AI hisobingizga kiring.");return null;}
  const response=await fetch("/api/news/sources",{method,headers:{"content-type":"application/json",authorization:"Bearer "+session.access_token},body:body?JSON.stringify(body):undefined});
  const raw=await response.text();
  let result:any;
  try { result=raw ? JSON.parse(raw) : {}; }
  catch { throw new Error("Server JSON o‘rniga xato sahifasini qaytardi (HTTP "+response.status+"): "+raw.slice(0,180).replace(/\\s+/g," ")); }
  if(!response.ok)throw new Error(result.error||result.message||"Xatolik (HTTP "+response.status+")"); return result;
 }
 async function load(){setLoading(true);try{const d=await call("GET");if(d)setSources(d.sources||[]);}catch(e){setNotice(e instanceof Error?e.message:"Manbalarni yuklab bo‘lmadi.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function save(e:React.FormEvent){e.preventDefault();setSaving(true);setNotice("");try{await call("POST",editingId?{action:"update",id:editingId,name,feedUrl,category,sourceGroup,siteUrl}:{name,feedUrl,category,sourceGroup,siteUrl});setName("");setFeedUrl("");setSiteUrl("");setEditingId(null);setNotice(editingId?"Manba yangilandi.":"Manba saqlandi.");await load();}catch(e){setNotice(e instanceof Error?e.message:"Saqlashda xatolik.");}finally{setSaving(false);}}
 async function runPipeline(){
  setPipelineBusy(true);setPipelineResult(null);setNotice("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("Avval hisobingizga kiring.");
   const headers={authorization:"Bearer "+session.access_token};
   const morningResponse=await fetch("/api/news/run?phase=morning",{method:"POST",headers});
   const morningRaw=await morningResponse.text();
   let morning:any;
   try{morning=morningRaw?JSON.parse(morningRaw):{};}catch{throw new Error("Ertalabki xabarlar serveri noto‘g‘ri javob qaytardi.");}
   if(!morningResponse.ok||morning.ok===false){const details=(morning.results||[]).map((x:any)=>x.slot+": "+(x.result?.error||x.result?.errors?.join("; ")||(x.result?.skipped?"o‘tkazib yuborildi":JSON.stringify(x.result)))).join(" | ");throw new Error(morning.error||details||"Ertalabki xabarlarni yuborishda xatolik (HTTP "+morningResponse.status+").");}
   const batches:any[]=[];
   const progressKey="ijod-news-collect-offset";
   let offset=Number(window.localStorage.getItem(progressKey)||0);
   let hasMoreSources=true;
   let collectAttempts=0;
   // Continue automatically through every source in small server-safe batches.
   while(hasMoreSources && collectAttempts<100){
    let response:Response|undefined;
    let data:any;
    let lastError="";
    for(let retry=0;retry<2;retry++){
     try{
      response=await fetch("/api/news/run?phase=collect&offset="+offset,{method:"POST",headers});
      const raw=await response.text();
      try{data=raw?JSON.parse(raw):{};}catch{throw new Error("Manbalarni yig‘ish serveri JSON qaytarmadi (HTTP "+response.status+").");}
      if(!response.ok)throw new Error(data.error||data.message||"Manbalarni yig‘ishda xatolik (HTTP "+response.status+").");
      lastError="";
      break;
     }catch(error){lastError=error instanceof Error?error.message:"Manba yig‘ishda xatolik.";}
    }
    if(lastError)throw new Error(lastError+" Offset saqlandi; qayta bosganda shu joydan davom etadi.");
    const collect=data.steps?.collect||data;
    batches.push(collect);
    offset=Number(data.nextOffset??collect.nextOffset??offset);
    hasMoreSources=Boolean(data.hasMore??collect.hasMore);
    if(hasMoreSources)window.localStorage.setItem(progressKey,String(offset));
    else window.localStorage.removeItem(progressKey);
    collectAttempts++;
    const checked=batches.reduce((n,x)=>n+Number(x.sourcesChecked||0),0);
    setNotice("Manbalar tekshirilmoqda: "+checked+" ta. Keyingi guruh avtomatik davom etadi...");
   }
   if(hasMoreSources)throw new Error("Xavfsizlik chegarasi: 500 ta manba tekshirildi. Qolganlari saqlandi; yana bosganda davom etadi.");
   const processBatches:any[]=[];
   let pendingMayRemain=true;
   // Process articles in small batches; keep the page responsive and avoid long server calls.
   for(let i=0;i<10&&pendingMayRemain;i++){
    const response=await fetch("/api/news/run?phase=process",{method:"POST",headers});
    const raw=await response.text();let processed:any;
    try{processed=raw?JSON.parse(raw):{};}catch{throw new Error("Tarjima serveri JSON qaytarmadi (HTTP "+response.status+").");}
    if(!response.ok)throw new Error(processed.error||processed.message||"Tarjima jarayonida xatolik (HTTP "+response.status+").");
    const result=processed.steps?.process||processed;
    processBatches.push(result);
    const count=Number(result.processed||0);
    // A full batch means more articles may remain. Failed deliveries are
    // delayed in the database, so the next iteration can move to other articles.
    pendingMayRemain=count>=1;
    if(count===0)pendingMayRemain=false;
    setNotice("Manbalar tekshirildi. Yangiliklar qayta ishlanmoqda: "+processBatches.length+" ta maqola...");
   }
   const processedSummary={
    batches:processBatches.length,
    processed:processBatches.reduce((n,x)=>n+Number(x.processed||0),0),
    translated:processBatches.reduce((n,x)=>n+Number(x.translated||0),0),
    telegramMessagesSent:processBatches.reduce((n,x)=>n+Number(x.telegramMessagesSent||0),0),
    channelMessagesSent:processBatches.reduce((n,x)=>n+Number(x.channelMessagesSent||0),0),
    channelConfigured:processBatches.some(x=>x.channelConfigured===true),
    remainingMayExist:pendingMayRemain,
    outcomes:processBatches.flatMap(x=>x.outcomes||[])
   };
   const collectSummary={sourcesChecked:batches.reduce((n,x)=>n+Number(x.sourcesChecked||0),0),sourcesOk:batches.reduce((n,x)=>n+Number(x.sourcesOk||0),0),sourcesFailed:batches.reduce((n,x)=>n+Number(x.sourcesFailed||0),0),itemsFound:batches.reduce((n,x)=>n+Number(x.itemsFound||0),0),articlesInserted:batches.reduce((n,x)=>n+Number(x.articlesInserted||0),0),duplicateItemsSkipped:batches.reduce((n,x)=>n+Number(x.duplicateItemsSkipped||0),0),failedSources:batches.flatMap(x=>x.failedSources||[])};
   setPipelineResult({morning,collect:collectSummary,process:processedSummary});
   setNotice(collectSummary.sourcesFailed===0&&!pendingMayRemain&&processedSummary.translated===processedSummary.processed?"Barcha manbalar tekshirildi va navbatdagi maqolalar qayta ishlandi.": "Barcha manbalar navbati tekshirildi. Ishlamagan manbalar natijada ko‘rsatilgan; qolgan maqolalar navbati keyingi ishga tushirishda davom etadi.");
  }catch(e){setNotice(e instanceof Error?e.message:"Jarayonda xatolik.");}
  finally{setPipelineBusy(false);}
 }
 async function setupWebhook(){try{const {data:{session}}=await supabase.auth.getSession();if(!session){setNotice("Avval hisobingizga kiring.");return;}const r=await fetch("/api/news/telegram/setup",{method:"POST",headers:{authorization:"Bearer "+session.access_token}});const raw=await r.text();let d:any;try{d=raw?JSON.parse(raw):{};}catch{throw new Error("Webhook serveri noto‘g‘ri javob qaytardi (HTTP "+r.status+").");}setNotice(d.ok?"Telegram webhook muvaffaqiyatli ulandi: "+d.webhookUrl:(d.error||"Webhook ulanmagan."));}catch{setNotice("Webhook sozlashda xatolik.");}}
 function editSource(item:Source){setEditingId(item.id);setName(item.name);setFeedUrl(item.feed_url);setSiteUrl(item.site_url||"");setSourceGroup(item.source_group||"RSS manbalari");const parent=item.category;const group=Object.entries(topicGroups).find(([key])=>key===parent)?.[1]?.[0]||Object.entries(topicGroups).find(([,topics])=>topics.length>0&&topics.some(t=>t===parent))?.[1]?.[0]||allTopics[0];setCategory(group);window.scrollTo({top:0,behavior:"smooth"});}
 async function toggleSource(item:Source){try{await call("POST",{action:"toggle",id:item.id,enabled:!item.enabled});setNotice(item.enabled?"Manba vaqtincha o‘chirildi.":"Manba qayta yoqildi.");await load();}catch(e){setNotice(e instanceof Error?e.message:"Holatni o‘zgartirishda xatolik.");}}
 async function remove(id:string){if(!confirm("Ushbu manbani o‘chirasizmi?"))return;try{await call("POST",{action:"delete",id});setNotice("Manba o‘chirildi.");await load();}catch(e){setNotice(e instanceof Error?e.message:"O‘chirishda xatolik.");}}
 return <main className="min-h-screen bg-[#f7f7fb] p-4 text-[#191923]"><div className="mx-auto max-w-5xl"><Link href="/news" className="text-sm text-violet-700">← AI News</Link><h1 className="my-4 text-3xl font-black">AI News — Manbalar</h1><p className="mb-6 text-sm text-gray-600">Yangi RSS/Atom manbalarini kodni o‘zgartirmasdan boshqaring.</p>{notice&&<div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm">{notice}</div>}
 <section className="mb-5 rounded-2xl border bg-white p-5"><h2 className="font-bold">Yangiliklarni yig‘ish</h2><p className="my-2 text-sm text-gray-600">Manbalarni tekshiradi, yangi maqolalarni bazaga qo‘shadi, uch tilga tayyorlaydi va obunachilarga yuboradi.</p><button type="button" disabled={pipelineBusy} onClick={()=>void runPipeline()} className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white disabled:opacity-50">{pipelineBusy?"Jarayon bajarilmoqda...":"Yangiliklarni hozir yig‘ish"}</button>{pipelineResult&&<div className="mt-4 rounded-xl bg-violet-50 p-4 text-sm"><b>Jarayon natijasi</b><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">{[["Ertalabki xabarlar",pipelineResult.morning?.sent??"—"],["Tekshirilgan manba",pipelineResult.collect?.sourcesChecked??"—"],["Ishlagan manba",pipelineResult.collect?.sourcesOk??"—"],["Xato manba",pipelineResult.collect?.sourcesFailed??"—"],["Topilgan maqola",pipelineResult.collect?.itemsFound??"—"],["Bazaga qo‘shilgan",pipelineResult.collect?.articlesInserted??"—"],["Dublikat",pipelineResult.collect?.duplicateItemsSkipped??"—"],["Tarjima qilingan",pipelineResult.process?.translated??"—"],["Telegramga yuborilgan",pipelineResult.process?.telegramMessagesSent??"—"],["Kanalga yuborilgan",pipelineResult.process?.channelMessagesSent??"—"]].map(([label,value])=><div key={String(label)} className="rounded-lg bg-white p-3"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-lg font-bold">{value}</div></div>)}</div>{pipelineResult.collect?.failedSources?.length>0&&<div className="mt-3 rounded-lg bg-white p-3"><b className="text-red-700">Ishlamagan manbalar</b>{pipelineResult.collect.failedSources.map((item:any,index:number)=><div key={index} className="mt-2 border-t pt-2 text-xs"><b>{item.source}</b><div className="text-red-700">{item.reason}{item.removedFromCatalog?" · Katalogdan olib tashlandi":item.removalError?" · O‘chirish xatosi: "+item.removalError:""}</div></div>)}</div>}<details className="mt-3"><summary className="cursor-pointer text-xs text-gray-600">Texnik tafsilotlar</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(pipelineResult,null,2)}</pre></details></div>}</section><section className="mb-5 rounded-2xl border bg-white p-5"><h2 className="font-bold">Telegram bot</h2><p className="my-2 text-sm text-gray-600">Bot webhookini IJOD AI serveriga ulang.</p><button type="button" onClick={()=>void setupWebhook()} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Telegram webhookni ulash</button></section><form onSubmit={save} className="mb-8 grid gap-3 rounded-2xl border bg-white p-5"><h2 className="font-bold">{editingId?"Manbani tahrirlash":"Yangi manba qo‘shish"}</h2><label className="grid gap-1 text-sm">Sayt nomi<input required value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border p-3" placeholder="Masalan: Kun.uz"/></label><label className="grid gap-1 text-sm">Asosiy sayt URL<input type="url" value={siteUrl} onChange={e=>setSiteUrl(e.target.value)} className="rounded-lg border p-3" placeholder="https://kun.uz"/></label><label className="grid gap-1 text-sm">RSS/Atom URL<input required type="url" value={feedUrl} onChange={e=>setFeedUrl(e.target.value)} className="rounded-lg border p-3" placeholder="https://example.com/rss.xml"/></label><label className="grid gap-1 text-sm">Asosiy kategoriya<select value={sourceGroup} onChange={e=>setSourceGroup(e.target.value)} className="rounded-lg border p-3">{sourceGroups.map(x=><option key={x}>{x}</option>)}</select></label><label className="grid gap-1 text-sm">Ichki mavzu<select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border p-3">{topicOptions.map(x=><option key={x.topic} value={x.topic}>{x.group} — {x.topic}</option>)}</select></label><div className="flex flex-wrap gap-2"><button disabled={saving} className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white disabled:opacity-50">{saving?"Saqlanmoqda...":editingId?"O‘zgarishlarni saqlash":"Manbani saqlash"}</button>{editingId&&<button type="button" onClick={()=>{setEditingId(null);setName("");setFeedUrl("");setSiteUrl("");}} className="rounded-xl border px-4 py-3 font-semibold">Bekor qilish</button>}</div></form>
 <section className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Mavjud manbalar katalogi</h2><p className="mt-1 text-xs text-gray-500">{sources.length} ta manba · {sourceGroups.length} ta asosiy kategoriya</p></div><button onClick={()=>void load()} className="rounded-lg border px-3 py-2 text-sm">Yangilash</button></div><div className="mb-4 grid gap-3 md:grid-cols-3"><label className="grid gap-1 text-sm">Asosiy kategoriya<select value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} className="rounded-lg border p-3"><option>Barchasi</option>{sourceGroups.map(x=><option key={x}>{x}</option>)}</select></label><label className="grid gap-1 text-sm">Ichki mavzu<select value={filterTopic} onChange={e=>setFilterTopic(e.target.value)} className="rounded-lg border p-3"><option>Barchasi</option>{topicOptions.map(x=><option key={x.topic} value={x.topic}>{x.group} — {x.topic}</option>)}</select></label><label className="grid gap-1 text-sm">Manba nomi yoki URL<input value={filterText} onChange={e=>setFilterText(e.target.value)} className="rounded-lg border p-3" placeholder="Masalan: ai, kun.uz, https://..."/></label></div>{loading?"Yuklanmoqda...":(()=>{const filtered=sources.filter(x=>(filterGroup==="Barchasi"||(x.source_group||"RSS manbalari")===filterGroup)&&(filterTopic==="Barchasi"||x.category===filterTopic||x.category===filterTopic.split(" — ").pop())&&(!filterText||x.name.toLowerCase().includes(filterText.toLowerCase())||x.feed_url.toLowerCase().includes(filterText.toLowerCase())||(x.site_url||"").toLowerCase().includes(filterText.toLowerCase())));return filtered.length===0?<p className="py-6 text-center text-sm text-gray-500">Tanlangan filtrlar bo‘yicha manba topilmadi.</p>:<><div className="mb-2 text-xs text-gray-500">{filtered.length} ta mos manba</div><div className="grid grid-cols-[1fr_1fr_2fr_auto_auto_auto] gap-3 border-b px-3 py-3 text-xs font-bold text-gray-500"><span>Asosiy kategoriya</span><span>Manba nomi</span><span>Asosiy URL</span><span>Holat</span><span>Tahrir</span><span>Amal</span></div>{sourceGroups.filter(g=>filterGroup==="Barchasi"||g===filterGroup).map(group=>{const items=filtered.filter(x=>(x.source_group||"RSS manbalari")===group);if(!items.length)return null;return <details key={group} className="border-b"><summary className="grid cursor-pointer list-none grid-cols-[1fr_1fr_2fr_auto_auto_auto] gap-3 bg-gray-50 px-3 py-3 text-sm font-semibold"><span>{group}</span><span></span><span></span><span className="text-gray-500">{items.length} ta⌄</span></summary>{items.map(item=>{const url=item.site_url||(()=>{try{return new URL(item.feed_url).origin}catch{return item.feed_url}})();return <div key={item.id} className="grid grid-cols-[1fr_1fr_2fr_auto_auto_auto] items-center gap-3 border-t px-3 py-3 text-sm"><span className="text-xs text-gray-500">{item.category}</span><span className="font-medium">{item.name}</span><a className="break-all text-xs text-violet-700 underline" href={url} target="_blank" rel="noreferrer">{url}</a><button onClick={()=>void toggleSource(item)} className="rounded-lg border px-3 py-2 text-xs">{item.enabled?"Faol":"O‘chiq"}</button><button onClick={()=>editSource(item)} className="rounded-lg border px-3 py-2 text-xs">Tahrirlash</button><button onClick={()=>void remove(item.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600">O‘chirish</button></div>})}</details>})}</>})()}</section></div></main>;
}
