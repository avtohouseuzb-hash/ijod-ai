"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ImageToolPage() {
  const [prompt, setPrompt] = useState("");
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

  async function generateImage() {
    if (!prompt.trim() || loading) return;
    setLoading(true); setError(""); setImage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Rasm yaratish uchun avval hisobingizga kiring.");
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data: { image?: string; error?: string; remainingCredits?: number } = await response.json();
      if (!response.ok) throw new Error(data.error || "Rasm yaratishda xatolik yuz berdi.");
      if (!data.image) throw new Error("Rasm natijasi bo‘sh qaytdi.");
      setImage(data.image);
      if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ulanishda xatolik. Qayta urinib ko‘ring.");
      void loadCredits();
    } finally { setLoading(false); }
  }

  if (authChecking) return <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] text-gray-500">Hisobingiz tekshirilmoqda...</main>;
  if (!signedIn) return <main className="min-h-screen bg-[#f7f7fb] p-6"><section className="mx-auto mt-16 max-w-md rounded-3xl bg-white p-8 text-center"><h1 className="text-2xl font-black">IJOD AI’ga kiring</h1><p className="mt-3 text-sm text-gray-500">AI Rasm vositasidan foydalanish uchun hisobingizga kiring.</p><Link className="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold text-white" href="/login">Kirish →</Link></section></main>;

  return <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8">
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="text-sm font-semibold text-violet-700">← Bosh sahifa</Link>
      <header className="mt-6 rounded-3xl bg-gradient-to-br from-[#191326] to-violet-900 p-8 text-white">
        <p className="text-xs font-bold tracking-widest text-violet-200">IJOD LABORATORIYASI</p>
        <h1 className="mt-3 text-3xl font-black">AI Rasm</h1>
        <p className="mt-3 text-sm text-white/75">G‘oyangizni tasvirga aylantiring. Nima chizish kerakligini batafsil yozing.</p>
        <p className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">✦ {credits === null ? "Kredit tekshirilmoqda..." : `${credits} kredit`}</p>
      </header>
      <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
        <label className="block text-sm font-semibold">Rasm tavsifi
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5} maxLength={2000} placeholder="Masalan: O‘zbekistondagi zamonaviy qahvaxona uchun reklama rasmi, iliq quyosh nuri, realistik fotografiya..." className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal outline-none focus:border-violet-400" />
          <span className="mt-1 block text-right text-xs font-normal text-gray-400">{prompt.length}/2000</span>
        </label>
        <button disabled={!prompt.trim() || loading} onClick={generateImage} className="mt-5 w-full rounded-xl bg-violet-600 p-3.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Rasm yaratilmoqda..." : "✨ Rasm yaratish"}</button>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {image && <section className="mt-6"><h2 className="mb-3 text-lg font-bold">Natija</h2><img src={image} alt="AI yaratgan rasm" className="w-full rounded-2xl border border-gray-100" /><a href={image} download="ijod-ai-image.png" className="mt-3 inline-block rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700">Rasmni yuklab olish</a></section>}
        <p className="mt-4 text-xs leading-5 text-gray-400">Har bir muvaffaqiyatli rasm yaratish 1 kredit ishlatadi. Xatolik bo‘lsa, kredit qaytarishga harakat qilinadi.</p>
      </section>
    </div>
  </main>;
}
