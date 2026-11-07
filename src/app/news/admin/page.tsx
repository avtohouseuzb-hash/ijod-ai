"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
const categories=["O‘zbekiston","Jahon","AI va IT","Biznes","Iqtisodiyot","Fan","Sport"];\nconst sourceGroups=["RSS manbalari","Rasmiy davlat saytlari","Yangilik portallari","Xalqaro tashkilotlar","Ilmiy jurnallar va tadqiqotlar","Kompaniya va banklarning rasmiy yangiliklari","Normativ-huquqiy hujjatlar portallari","Ochiq API manbalari","Administrator kiritgan maxsus URL"];
type Source={id:string;name:string;feed_url:string;site_url?:string|null;source_group?:string|null;connector_type?:string|null;category:string;enabled:boolean};
export default function NewsAdminPage(){
 const [sources,setSources]=useState<Source[]>([]);
 const [name,setName]=useState(""); const [feedUrl,setFeedUrl]=useState(""); const [category,setCategory]=useState(categories[0]); const [sourceGroup,setSourceGroup]=useState(sourceGroups[0]); const [siteUrl,setSiteUrl]=useState("");
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState(""); const [pipelineBusy,setPipelineBusy]=useState(false); const [pipelineResult,setPipelineResult]=useState<any>(null);
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
 async function save(e:React.FormEvent){e.preventDefault();setSaving(true);setNotice("");try{await call("POST",{name,feedUrl,category,sourceGroup,siteUrl});setName("");setFeedUrl("");setSiteUrl("");setNotice("Manba saqlandi.");await load();}catch(e){setNotice(e instanceof Error?e.message:"Saqlashda xatolik.");}finally{setSaving(false);}}
 async function runPipeline(){
  setPipelineBusy(true);setPipelineResult(null);setNotice("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("Avval hisobingizga kiring.");
   const headers={authorization:"Bearer "+session.access_token};
   const batches:any[]=[];
   let offset=0;
   for(let i=0;i<20;i++){
    const response=await fetch("/api/news/run?phase=collect&offset="+offset,{method:"POST",headers});
    const raw=await response.text();let data:any;
    try{data=raw?JSON.parse(raw):{};}catch{throw new Error("Manbalarni yig‘ish serveri JSON qaytarmadi (HTTP "+response.status+").");}
    if(!response.ok)throw new Error(data.error||data.message||"Manbalarni yig‘ishda xatolik (HTTP "+response.status+").");
    batches.push(data.steps?.collect||data);
    offset=Number(data.nextOffset||offset);
    if(!data.hasMore)break;
    if(i===19)throw new Error("Xavfsizlik limiti: 20 ta guruhdan keyin jarayon to‘xtatildi. Qolgan manbalarni keyingi urinishda davom ettiring.");
   }
   const processBatches:any[]=[];
   let pendingMayRemain=true;
   for(let i=0;i<5&&pendingMayRemain;i++){
    const response=await fetch("/api/news/run?phase=process",{method:"POST",headers});
    const raw=await response.text();let processed:any;
    try{processed=raw?JSON.parse(raw):{};}catch{throw new Error("Tarjima serveri JSON qaytarmadi (HTTP "+response.status+").");}
    if(!response.ok)throw new Error(processed.error||processed.message||"Tarjima jarayonida xatolik (HTTP "+response.status+").");
    const result=processed.steps?.process||processed;
    processBatches.push(result);
    const count=Number(result.processed||0);
    const translated=Number(result.translated||0);
    // The process endpoint takes up to 10 pending articles per call.
    // Stop when the queue is exhausted or when a batch made no progress,
    // so a repeatedly failing article cannot create an endless loop.
    pendingMayRemain=count>=10&&translated>0;
    if(count===0)pendingMayRemain=false;
   }
   const processedSummary={
    batches:processBatches.length,
    processed:processBatches.reduce((n,x)=>n+Number(x.processed||0),0),
    translated:processBatches.reduce((n,x)=>n+Number(x.translated||0),0),
    telegramMessagesSent:processBatches.reduce((n,x)=>n+Number(x.telegramMessagesSent||0),0),
    remainingMayExist:pendingMayRemain,
    outcomes:processBatches.flatMap(x=>x.outcomes||[])
   };
   const collectSummary={sourcesChecked:batches.reduce((n,x)=>n+Number(x.sourcesChecked||0),0),sourcesOk:batches.reduce((n,x)=>n+Number(x.sourcesOk||0),0),sourcesFailed:batches.reduce((n,x)=>n+Number(x.sourcesFailed||0),0),itemsFound:batches.reduce((n,x)=>n+Number(x.itemsFound||0),0),articlesInserted:batches.reduce((n,x)=>n+Number(x.articlesInserted||0),0),duplicateItemsSkipped:batches.reduce((n,x)=>n+Number(x.duplicateItemsSkipped||0),0),failedSources:batches.flatMap(x=>x.failedSources||[])};
   setPipelineResult({collect:collectSummary,process:processedSummary});
   setNotice(collectSummary.sourcesFailed===0&&!pendingMayRemain&&processedSummary.translated===processedSummary.processed?"Barcha manbalar tekshirildi va navbatdagi maqolalar qayta ishlandi.":"Jarayon qisman bajarildi. Ayrim manba yoki maqolalarda xatolik bor yoxud navbat davom etmoqda.");
  }catch(e){setNotice(e instanceof Error?e.message:"Jarayonda xatolik.");}
  finally{setPipelineBusy(false);}
 }
 async function setupWebhook(){try{const {data:{session}}=await supabase.auth.getSession();if(!session){setNotice("Avval hisobingizga kiring.");return;}const r=await fetch("/api/news/telegram/setup",{method:"POST",headers:{authorization:"Bearer "+session.access_token}});const raw=await r.text();let d:any;try{d=raw?JSON.parse(raw):{};}catch{throw new Error("Webhook serveri noto‘g‘ri javob qaytardi (HTTP "+r.status+").");}setNotice(d.ok?"Telegram webhook muvaffaqiyatli ulandi: "+d.webhookUrl:(d.error||"Webhook ulanmagan."));}catch{setNotice("Webhook sozlashda xatolik.");}}
 async function remove(id:string){if(!confirm("Ushbu manbani o‘chirasizmi?"))return;try{await call("POST",{action:"delete",id});setNotice("Manba o‘chirildi.");await load();}catch(e){setNotice(e instanceof Error?e.message:"O‘chirishda xatolik.");}}
 return <main className="min-h-screen bg-[#f7f7fb] p-4 text-[#191923]"><div className="mx-auto max-w-5xl"><Link href="/news" className="text-sm text-violet-700">← AI News</Link><h1 className="my-4 text-3xl font-black">AI News — Manbalar</h1><p className="mb-6 text-sm text-gray-600">Yangi RSS/API manbalarini kodni o‘zgartirmasdan boshqaring.</p>{notice&&<div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm">{notice}</div>}
 <section className="mb-5 rounded-2xl border bg-white p-5"><h2 className="font-bold">Yangiliklarni yig‘ish</h2><p className="my-2 text-sm text-gray-600">Manbalarni tekshiradi, yangi maqolalarni bazaga qo‘shadi, uch tilga tayyorlaydi va obunachilarga yuboradi.</p><button type="button" disabled={pipelineBusy} onClick={()=>void runPipeline()} className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white disabled:opacity-50">{pipelineBusy?"Jarayon bajarilmoqda...":"Yangiliklarni hozir yig‘ish"}</button>{pipelineResult&&<div className="mt-4 rounded-xl bg-violet-50 p-4 text-sm"><b>Jarayon natijasi</b><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(pipelineResult.steps||pipelineResult,null,2)}</pre></div>}</section><section className="mb-5 rounded-2xl border bg-white p-5"><h2 className="font-bold">Telegram bot</h2><p className="my-2 text-sm text-gray-600">Bot webhookini IJOD AI serveriga ulang.</p><button type="button" onClick={()=>void setupWebhook()} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Telegram webhookni ulash</button></section><form onSubmit={save} className="mb-8 grid gap-3 rounded-2xl border bg-white p-5"><h2 className="font-bold">Yangi manba qo‘shish</h2><label className="grid gap-1 text-sm">Sayt nomi<input required value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border p-3" placeholder="Masalan: Kun.uz"/></label><label className="grid gap-1 text-sm">Asosiy sayt URL<input type="url" value={siteUrl} onChange={e=>setSiteUrl(e.target.value)} className="rounded-lg border p-3" placeholder="https://kun.uz"/></label><label className="grid gap-1 text-sm">RSS/API URL (ichki manzil)<input required type="url" value={feedUrl} onChange={e=>setFeedUrl(e.target.value)} className="rounded-lg border p-3" placeholder="https://example.com/rss.xml"/></label><label className="grid gap-1 text-sm">Asosiy kategoriya<select value={sourceGroup} onChange={e=>setSourceGroup(e.target.value)} className="rounded-lg border p-3">{sourceGroups.map(x=><option key={x}>{x}</option>)}</select></label><label className="grid gap-1 text-sm">Ichki mavzu<select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border p-3">{categories.map(x=><option key={x}>{x}</option>)}</select></label><button disabled={saving} className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white disabled:opacity-50">{saving?"Saqlanmoqda...":"Manbani saqlash"}</button></form>
 <section className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Mavjud manbalar katalogi</h2><p className="mt-1 text-xs text-gray-500">{sources.length} ta manba · 9 ta asosiy guruh</p></div><button onClick={()=>void load()} className="rounded-lg border px-3 py-2 text-sm">Yangilash</button></div>{loading?"Yuklanmoqda...":sources.length===0?"Manbalar topilmadi.":<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="px-3 py-3">Asosiy kategoriya</th><th className="px-3 py-3">Manba nomi</th><th className="px-3 py-3">Asosiy URL</th><th className="px-3 py-3">Amal</th></tr></thead><tbody>{sourceGroups.map(group=>{const items=sources.filter(x=>(x.source_group||"RSS manbalari")===group);return <details key={group} className="contents"><summary className="cursor-pointer list-none border-b bg-gray-50 px-3 py-3 font-semibold">{group} <span className="ml-2 text-xs font-normal text-gray-500">({items.length})</span> <span className="float-right text-gray-500">⌄</span></summary>{items.map(item=><tr key={item.id} className="border-b"><td className="px-3 py-3 text-gray-500">{group}</td><td className="px-3 py-3 font-medium">{item.name}</td><td className="px-3 py-3"><a className="break-all text-violet-700 underline" href={item.site_url||(()=>{try{return new URL(item.feed_url).origin}catch{return item.feed_url}})()} target="_blank" rel="noreferrer">{item.site_url||(()=>{try{return new URL(item.feed_url).origin}catch{return item.feed_url}})()}</a></td><td className="px-3 py-3"><button onClick={()=>void remove(item.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600">O‘chirish</button></td></tr>)}</details>})}</tbody></table></div>}</section></div></main>;
}
