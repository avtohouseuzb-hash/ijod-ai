"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
const categories=["O‘zbekiston","Jahon","AI va IT","Biznes","Iqtisodiyot","Fan","Sport"];
type Source={id:string;name:string;feed_url:string;category:string;enabled:boolean};
export default function NewsAdminPage(){
 const [sources,setSources]=useState<Source[]>([]);
 const [name,setName]=useState(""); const [feedUrl,setFeedUrl]=useState(""); const [category,setCategory]=useState(categories[0]);
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState("");
 async function call(method:"GET"|"POST",body?:unknown){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){setNotice("Avval IJOD AI hisobingizga kiring.");return null;}
  const response=await fetch("/api/news/sources",{method,headers:{"content-type":"application/json",authorization:"Bearer "+session.access_token},body:body?JSON.stringify(body):undefined});
  const result=await response.json(); if(!response.ok)throw new Error(result.error||"Xatolik"); return result;
 }
 async function load(){setLoading(true);try{const d=await call("GET");if(d)setSources(d.sources||[]);}catch(e){setNotice(e instanceof Error?e.message:"Manbalarni yuklab bo‘lmadi.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function save(e:React.FormEvent){e.preventDefault();setSaving(true);setNotice("");try{await call("POST",{name,feedUrl,category});setName("");setFeedUrl("");setNotice("Manba saqlandi.");await load();}catch(e){setNotice(e instanceof Error?e.message:"Saqlashda xatolik.");}finally{setSaving(false);}}
 async function setupWebhook(){try{const {data:{session}}=await supabase.auth.getSession();if(!session){setNotice("Avval hisobingizga kiring.");return;}const r=await fetch("/api/news/telegram/setup",{method:"POST",headers:{authorization:"Bearer "+session.access_token}});const d=await r.json();setNotice(d.ok?"Telegram webhook muvaffaqiyatli ulandi: "+d.webhookUrl:(d.error||"Webhook ulanmagan."));}catch{setNotice("Webhook sozlashda xatolik.");}}
 async function remove(id:string){if(!confirm("Ushbu manbani o‘chirasizmi?"))return;try{await call("POST",{action:"delete",id});setNotice("Manba o‘chirildi.");await load();}catch(e){setNotice(e instanceof Error?e.message:"O‘chirishda xatolik.");}}
 return <main className="min-h-screen bg-[#f7f7fb] p-4 text-[#191923]"><div className="mx-auto max-w-5xl"><Link href="/news" className="text-sm text-violet-700">← AI News</Link><h1 className="my-4 text-3xl font-black">AI News — Manbalar</h1><p className="mb-6 text-sm text-gray-600">Yangi RSS/API manbalarini kodni o‘zgartirmasdan boshqaring.</p>{notice&&<div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm">{notice}</div>}
 <section className="mb-5 rounded-2xl border bg-white p-5"><h2 className="font-bold">Telegram bot</h2><p className="my-2 text-sm text-gray-600">Bot webhookini IJOD AI serveriga ulang.</p><button type="button" onClick={()=>void setupWebhook()} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Telegram webhookni ulash</button></section><form onSubmit={save} className="mb-8 grid gap-3 rounded-2xl border bg-white p-5"><h2 className="font-bold">Yangi manba qo‘shish</h2><label className="grid gap-1 text-sm">Sayt nomi<input required value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border p-3" placeholder="Masalan: Kun.uz"/></label><label className="grid gap-1 text-sm">RSS/API URL<input required type="url" value={feedUrl} onChange={e=>setFeedUrl(e.target.value)} className="rounded-lg border p-3" placeholder="https://example.com/rss.xml"/></label><label className="grid gap-1 text-sm">Kategoriya<select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border p-3">{categories.map(x=><option key={x}>{x}</option>)}</select></label><button disabled={saving} className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white disabled:opacity-50">{saving?"Saqlanmoqda...":"Manbani saqlash"}</button></form>
 <section className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Mavjud manbalar</h2><button onClick={()=>void load()} className="rounded-lg border px-3 py-2 text-sm">Yangilash</button></div>{loading?"Yuklanmoqda...":sources.length===0?"Manbalar topilmadi.":<div className="divide-y">{sources.map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="font-semibold">{s.name} <span className="ml-2 text-xs text-gray-500">{s.category}</span></div><div className="break-all text-xs text-gray-500">{s.feed_url}</div></div><button onClick={()=>void remove(s.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">O‘chirish</button></div>)}</div>}</section></div></main>;
}
