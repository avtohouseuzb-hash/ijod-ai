"use client";

import Link from "next/link";
import { useState } from "react";

export default function TextToolPage() {
  const [kind, setKind] = useState("Instagram posti");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Samimiy");
  const [copied, setCopied] = useState(false);
  const task = `IJOD AI matn topshirig‘i\nTuri: ${kind}\nMavzu: ${topic}\nOhang: ${tone}`;
  async function copyTask() {
    await navigator.clipboard.writeText(task);
    setCopied(true);
  }
  return <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8"><div className="mx-auto max-w-4xl"><Link href="/" className="text-sm font-semibold text-violet-700">← Bosh sahifa</Link><header className="mt-6 rounded-3xl bg-gradient-to-br from-[#191326] to-violet-900 p-8 text-white"><p className="text-xs font-bold tracking-widest text-violet-200">IJOD LABORATORIYASI</p><h1 className="mt-3 text-3xl font-black">AI Matn</h1><p className="mt-3 text-sm text-white/75">Post, reklama va Reels ssenariysi uchun topshiriq tayyorlang.</p></header><section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6"><label className="block text-sm font-semibold">Matn turi<select value={kind} onChange={e=>setKind(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"><option>Instagram posti</option><option>Reklama matni</option><option>Reels ssenariysi</option><option>Mahsulot tavsifi</option><option>Kontent g‘oyalari</option></select></label><label className="mt-5 block text-sm font-semibold">Mavzu yoki g‘oya<textarea value={topic} onChange={e=>setTopic(e.target.value)} rows={5} placeholder="Masalan: yangi mahsulot uchun Instagram posti..." className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal outline-none focus:border-violet-400" /></label><label className="mt-5 block text-sm font-semibold">Matn ohangi<select value={tone} onChange={e=>setTone(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"><option>Samimiy</option><option>Professional</option><option>Ijodiy va qiziqarli</option></select></label><button disabled={!topic.trim()} onClick={copyTask} className="mt-5 w-full rounded-xl bg-violet-600 p-3.5 text-sm font-bold text-white disabled:opacity-40">{copied ? "Topshiriq nusxalandi ✓" : "Topshiriqni nusxalash"}</button><p className="mt-3 text-xs leading-5 text-gray-400">Bu dastlabki ish oynasi. Haqiqiy AI matn yaratishni ulash uchun keyingi bosqichda server API va OpenAI billingini sozlaymiz.</p></section></div></main>;
}
