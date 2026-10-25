"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DesignKind = "instagram" | "story" | "banner" | "poster";

const formats: { id: DesignKind; title: string; size: string; description: string }[] = [
  { id: "instagram", title: "Instagram post", size: "1024x1024", description: "Kvadrat post" },
  { id: "story", title: "Story / Reels", size: "1024x1536", description: "Tik format" },
  { id: "banner", title: "Reklama banneri", size: "1536x1024", description: "Gorizontal format" },
  { id: "poster", title: "Poster / afisha", size: "1024x1536", description: "Vertikal dizayn" },
];

const ideas = [
  "Minimalistik uslubdagi zamonaviy kafe uchun Instagram reklama posti",
  "Ayollar kiyim do‘koni uchun nafis, premium uslubdagi yangi kolleksiya reklamasi",
  "Bolalar o‘quv markazi uchun rang-barang, quvnoq va e’tibor tortuvchi reklama",
  "Onlayn do‘kon uchun mahsulotni markazga qo‘ygan professional reklama dizayni",
];

export default function DesignToolPage() {
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<DesignKind>("instagram");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(Boolean(data.session));
      setAuthChecking(false);
      if (data.session) void loadCredits();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setAuthChecking(false);
      if (session) void loadCredits();
      else setCredits(null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function loadCredits() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("profiles").select("credits").eq("user_id", session.user.id).maybeSingle();
    if (typeof data?.credits === "number") setCredits(data.credits);
  }

  async function generateDesign() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setImage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Dizayn yaratish uchun avval hisobingizga kiring.");
      const selected = formats.find((item) => item.id === format)!;
      const designPrompt = `Create a polished, professional ${selected.title} design. Format: ${selected.description}. Visual brief: ${prompt.trim()}. Make the composition clean, high quality, visually striking, and suitable for a real marketing campaign. If text is requested, use short, legible text and avoid random letters. Do not add watermarks.`;
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: designPrompt, size: selected.size }),
      });
      const data: { image?: string; error?: string; remainingCredits?: number } = await response.json();
      if (!response.ok) throw new Error(data.error || "Dizayn yaratishda xatolik yuz berdi.");
      if (!data.image) throw new Error("Dizayn natijasi bo‘sh qaytdi.");
      setImage(data.image);
      if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ulanishda xatolik. Qayta urinib ko‘ring.");
      void loadCredits();
    } finally {
      setLoading(false);
    }
  }

  if (authChecking) return <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] text-gray-500">Hisobingiz tekshirilmoqda...</main>;
  if (!signedIn) return <main className="min-h-screen bg-[#f7f7fb] p-6"><section className="mx-auto mt-16 max-w-md rounded-3xl bg-white p-8 text-center"><h1 className="text-2xl font-black">IJOD AI’ga kiring</h1><p className="mt-3 text-sm text-gray-500">AI Dizayn vositasidan foydalanish uchun hisobingizga kiring.</p><Link className="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold text-white" href="/login">Kirish →</Link></section></main>;

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-semibold text-violet-700">← Bosh sahifa</Link>
        <header className="mt-6 rounded-3xl bg-gradient-to-br from-[#153b31] to-emerald-800 p-7 text-white sm:p-9">
          <p className="text-xs font-bold tracking-widest text-emerald-100">IJOD LABORATORIYASI</p>
          <h1 className="mt-3 text-3xl font-black">AI Dizayn</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Uzum Market, Yandex Market, Wildberries va Ozon uchun mahsulot kartalari hamda reklama bannerlari yarating.</p>
          <p className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">✦ {credits === null ? "Kredit tekshirilmoqda..." : `${credits} kredit`}</p>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold">1. Dizayn formatini tanlang</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {formats.map((item) => (
                <button key={item.id} type="button" onClick={() => setFormat(item.id)} className={`rounded-2xl border p-4 text-left transition ${format === item.id ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-gray-200 hover:border-emerald-200"}`}>
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-1 block text-xs text-gray-500">{item.description}</span>
                </button>
              ))}
            </div>

            <h2 className="mt-7 text-lg font-bold">2. Qanday dizayn kerak?</h2>
            <label className="mt-3 block text-sm font-semibold">Dizayn tavsifi
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} maxLength={1500} placeholder="Masalan: Labbay do‘koni uchun oq va binafsha ranglarda premium reklama. Mahsulot markazda, sarlavha qisqa, ko‘rinishi zamonaviy..." className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal outline-none focus:border-emerald-400" />
              <span className="mt-1 block text-right text-xs font-normal text-gray-400">{prompt.length}/1500</span>
            </label>
            <button disabled={!prompt.trim() || loading} onClick={generateDesign} className="mt-5 w-full rounded-xl bg-emerald-700 p-3.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Dizayn yaratilmoqda..." : "✦ Dizayn yaratish"}</button>
            {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <p className="mt-4 text-xs leading-5 text-gray-400">Har bir muvaffaqiyatli dizayn 1 kredit ishlatadi. Xatolik bo‘lsa, kredit avtomatik qaytariladi.</p>
          </div>

          <aside className="rounded-3xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold">G‘oya tanlash</h2>
            <p className="mt-1 text-sm text-gray-500">Boshlash uchun namunalardan birini bosing.</p>
            <div className="mt-4 space-y-3">
              {ideas.map((idea) => <button key={idea} onClick={() => setPrompt(idea)} className="w-full rounded-xl border border-gray-200 p-3 text-left text-sm leading-5 transition hover:border-emerald-300 hover:bg-emerald-50">{idea}</button>)}
            </div>
            <div className="mt-6 rounded-2xl bg-gray-50 p-4">
              <h3 className="text-sm font-bold">Yaxshi natija uchun</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-gray-500">
                <li>Brend va mahsulotni yozing.</li>
                <li>Ranglar va uslubni belgilang.</li>
                <li>Kerakli matnni qisqa yozing.</li>
              </ul>
            </div>
          </aside>
        </section>

        {image && <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Tayyor dizayn</h2><a href={image} download="ijod-ai-design.png" className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800">Yuklab olish</a></div><img src={image} alt="AI yaratgan dizayn" className="mt-4 w-full rounded-2xl border border-gray-100" /></section>}
      </div>
    </main>
  );
}
