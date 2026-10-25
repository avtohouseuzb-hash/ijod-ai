"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const modes = [
  { id: "product", type: "AI Mahsulot sotuvchi", title: "AI Mahsulot sotuvchi", description: "Mahsulot ma’lumotidan marketplace kartasi, SEO tavsifi, afzalliklar, kalit so‘zlar va reklama ssenariysi yarating.", placeholder: "Masalan: ayollar uchun qishki sensorli qo‘lqop, qora rang, telefon ekranida ishlaydi, universal o‘lcham..." },
  { id: "content", type: "AI Kontent-reja", title: "AI Kontent-reja", description: "Brendingiz uchun 7 kunlik kontent reja, post va Reels g‘oyalarini yarating.", placeholder: "Masalan: ayollar kiyim do‘koni, auditoriya 18–35 yosh, Instagram orqali sotuv..." },
  { id: "marketing", type: "AI Marketing maslahatchi", title: "AI Marketing maslahatchi", description: "Taklif, reklama matnlari, auditoriya va A/B test rejasini oling.", placeholder: "Mahsulot/xizmat, auditoriya, narx va reklama maqsadini yozing..." },
  { id: "brand", type: "AI Brend yaratish", title: "AI Brend yaratish", description: "Brend pozitsiyasi, slogan, ranglar palitrasi va Instagram bio ustida ishlang.", placeholder: "Brend nomi, yo‘nalishi, mijozlari va taassurotini yozing..." },
  { id: "document", type: "AI Hujjat yordamchisi", title: "AI Hujjat yordamchisi", description: "Matnni soddalashtirish, qisqartirish, tartibga solish yoki tushuntirish uchun matn va topshiriq kiriting.", placeholder: "Topshiriqni va tahrir qilinadigan matnni shu yerga joylang..." },
  { id: "reels", type: "AI Reels ssenariy paketi", title: "AI Reels ssenariy paketi", description: "15–30 soniyalik Reels uchun hook, kadrlar, ekrandagi yozuv, voiceover va CTA oling.", placeholder: "Mahsulot/xizmat, video maqsadi va kimga mo‘ljallanganini yozing..." },
] as const;

export default function BusinessToolsPage() {
  const searchParams = useSearchParams();
  const [modeId, setModeId] = useState(searchParams.get("mode") || "product");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [copied, setCopied] = useState(false);
  const mode = modes.find((item) => item.id === modeId) ?? modes[0];

  useEffect(() => {
    const next = searchParams.get("mode");
    if (next && modes.some((item) => item.id === next)) setModeId(next);
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(Boolean(data.session)); setAuthChecking(false);
      if (data.session) void loadCredits();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session)); setAuthChecking(false);
      if (session) void loadCredits(); else setCredits(null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function loadCredits() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("profiles").select("credits").eq("user_id", session.user.id).maybeSingle();
    if (typeof data?.credits === "number") setCredits(data.credits);
  }

  async function generate() {
    if (!topic.trim() || loading) return;
    setLoading(true); setError(""); setResult(""); setCopied(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("AI vositasidan foydalanish uchun avval hisobingizga kiring.");
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: mode.type, topic: topic.trim(), tone }),
      });
      const data: { text?: string; error?: string; remainingCredits?: number } = await response.json();
      if (!response.ok) throw new Error(data.error || "Natija yaratilmadi.");
      if (!data.text?.trim()) throw new Error("AI bo‘sh javob qaytardi. Qayta urinib ko‘ring.");
      setResult(data.text);
      if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
    } catch (e) { setError(e instanceof Error ? e.message : "Xatolik yuz berdi. Qayta urinib ko‘ring."); }
    finally { setLoading(false); }
  }

  async function copyResult() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result); setCopied(true); }
    catch { setError("Nusxalash imkoni bo‘lmadi. Matnni belgilab nusxalang."); }
  }

  if (authChecking) return <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] text-sm text-gray-500">Hisobingiz tekshirilmoqda...</main>;
  if (!signedIn) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 text-[#191923]">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <div className="text-3xl">✦</div><h1 className="mt-4 text-2xl font-black">IJOD AI Biznes Studio</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">Bu vositalardan foydalanish uchun hisobingizga kiring.</p>
        <Link href="/login" className="mt-6 block rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white">Kirish yoki ro‘yxatdan o‘tish →</Link>
        <Link href="/" className="mt-4 block text-sm font-semibold text-gray-500">← Bosh sahifa</Link>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-violet-700">← Bosh sahifa</Link>
        <header className="mt-6 rounded-3xl bg-gradient-to-br from-[#191326] to-violet-900 p-7 text-white sm:p-9">
          <p className="text-xs font-bold tracking-widest text-violet-200">IJOD AI · BIZNES STUDIO</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{mode.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{mode.description}</p>
          <p className="mt-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">✦ {credits === null ? "Kredit tekshirilmoqda..." : credits + " kredit"}</p>
        </header>
        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
          <label className="block text-sm font-semibold">AI vositasi
            <select value={modeId} onChange={(e) => { setModeId(e.target.value); setResult(""); setError(""); }} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3">
              {modes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="mt-5 block text-sm font-semibold">Ma’lumot va topshiriq
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={7} maxLength={4000} placeholder={mode.placeholder} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal outline-none focus:border-violet-400" />
            <span className="mt-1 block text-right text-xs font-normal text-gray-400">{topic.length}/4000</span>
          </label>
          <label className="mt-4 block text-sm font-semibold">Uslub
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"><option>Professional</option><option>Samimiy</option><option>Ijodiy va qiziqarli</option></select>
          </label>
          <button disabled={!topic.trim() || loading} onClick={generate} className="mt-5 w-full rounded-xl bg-violet-600 p-3.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "AI tayyorlayapti..." : "✦ Natija yaratish (1 kredit)"}</button>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {result && <section className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Tayyor natija</h2><button onClick={copyResult} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700">{copied ? "Nusxalandi ✓" : "Nusxalash"}</button></div><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-800">{result}</div></section>}
          <p className="mt-4 text-xs leading-5 text-gray-400">Har bir muvaffaqiyatli generatsiya 1 kredit ishlatadi. API xatoligida kreditni qaytarishga urinamiz. Ushbu sahifa matnli natijalar yaratadi; video montaj yoki rasm faylini avtomatik tahrirlash funksiyasi emas.</p>
        </section>
      </div>
    </main>
  );
}
