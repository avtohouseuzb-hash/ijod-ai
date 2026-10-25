"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const voices = [
  { id: "alloy", name: "Alloy", detail: "Muvozanatli" },
  { id: "ash", name: "Ash", detail: "Aniq va ravshan" },
  { id: "ballad", name: "Ballad", detail: "Yumshoq" },
  { id: "coral", name: "Coral", detail: "Iliq" },
  { id: "echo", name: "Echo", detail: "Chuqurroq" },
  { id: "fable", name: "Fable", detail: "Ifodali" },
  { id: "nova", name: "Nova", detail: "Jonli" },
  { id: "onyx", name: "Onyx", detail: "Past ohang" },
  { id: "sage", name: "Sage", detail: "Sokin" },
  { id: "shimmer", name: "Shimmer", detail: "Yengil" },
  { id: "verse", name: "Verse", detail: "Ifodali nutq" },
];

export default function AudioToolPage() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

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
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadCredits() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("profiles").select("credits").eq("user_id", session.user.id).maybeSingle();
    if (typeof data?.credits === "number") setCredits(data.credits);
  }

  async function generateSpeech() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError("");
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSignedIn(false);
        throw new Error("Ovoz yaratish uchun avval hisobingizga kiring.");
      }
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ text: text.trim(), voice }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Ovoz yaratishda xatolik yuz berdi.");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("Audio fayl bo‘sh qaytdi.");
      setAudioUrl(URL.createObjectURL(blob));
      const remaining = response.headers.get("X-Remaining-Credits");
      if (remaining && Number.isFinite(Number(remaining))) setCredits(Number(remaining));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ulanishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }

  if (authChecking) return <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] text-gray-500">Hisobingiz tekshirilmoqda...</main>;

  if (!signedIn) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 text-[#191923]">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <div className="text-3xl">♫</div>
        <h1 className="mt-4 text-2xl font-black">IJOD AI — Ovoz</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">Matnni audio faylga aylantirish uchun avval hisobingizga kiring.</p>
        <Link href="/login" className="mt-6 block rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">Kirish yoki ro‘yxatdan o‘tish →</Link>
        <Link href="/" className="mt-4 block text-sm font-semibold text-gray-500">← Bosh sahifa</Link>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-violet-700">← Bosh sahifa</Link>
        <header className="mt-6 rounded-3xl bg-gradient-to-br from-[#191326] to-violet-900 p-8 text-white">
          <p className="text-xs font-bold tracking-widest text-violet-200">IJOD LABORATORIYASI</p>
          <h1 className="mt-3 text-3xl font-black">AI Ovoz</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">Matningizni AI yaratgan nutqqa aylantiring, tinglang va MP3 faylini yuklab oling.</p>
          <p className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">✦ {credits === null ? "Kredit tekshirilmoqda..." : `${credits} kredit`}</p>
        </header>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
          <label className="block text-sm font-semibold">
            Ovozga aylantiriladigan matn
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} maxLength={4000} placeholder="Matnni shu yerga kiriting. Masalan: Assalomu alaykum! IJOD AI platformasiga xush kelibsiz..." className="mt-2 w-full rounded-xl border border-gray-200 p-4 font-normal leading-6 outline-none focus:border-violet-400" />
            <span className="mt-1 block text-right text-xs font-normal text-gray-400">{text.length}/4000</span>
          </label>

          <label className="mt-5 block text-sm font-semibold">
            Ovoz turi
            <select value={voice} onChange={(e) => setVoice(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3">
              {voices.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.detail}</option>)}
            </select>
          </label>

          <button disabled={text.trim().length < 2 || loading} onClick={generateSpeech} className="mt-5 w-full rounded-xl bg-violet-600 p-3.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? "Ovoz yaratilmoqda..." : "♫ Ovoz yaratish"}
          </button>

          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          {audioUrl && (
            <section className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
              <h2 className="text-lg font-bold">Tayyor audio</h2>
              <audio controls src={audioUrl} className="mt-4 w-full">Brauzeringiz audio ijrosini qo‘llab-quvvatlamaydi.</audio>
              <a href={audioUrl} download="ijod-ai-voice.mp3" className="mt-4 inline-flex rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700">⬇ MP3 yuklab olish</a>
            </section>
          )}

          <p className="mt-4 text-xs leading-5 text-gray-400">Bu audio sun’iy intellekt tomonidan yaratiladi, inson ovozi emas. Har bir muvaffaqiyatli so‘rov 1 IJOD AI kreditidan foydalanadi; OpenAI API sarfi alohida hisoblanadi. O‘zbekcha talaffuz sifati farq qilishi mumkin.</p>
        </section>
      </div>
    </main>
  );
}
