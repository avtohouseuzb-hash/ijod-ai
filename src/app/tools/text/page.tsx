"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TextToolPage() {
  const [kind, setKind] = useState("Instagram posti");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Samimiy");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSignedIn(Boolean(data.session));
        setAuthChecking(false);
        if (data.session) void loadCredits();
      }
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
    const { data } = await supabase
      .from("profiles")
      .select("credits")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (typeof data?.credits === "number") setCredits(data.credits);
  }

  async function generateText() {
    if (!topic.trim()) return;

    setLoading(true);
    setError("");
    setResult("");
    setCopied(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSignedIn(false);
        throw new Error("AI matn yaratish uchun avval hisobingizga kiring.");
      }

      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: kind, topic: topic.trim(), tone }),
      });

      const data: { text?: string; error?: string; code?: string; remainingCredits?: number } = await response.json();

      if (!response.ok) {
        throw new Error(`${data.error || "Matn yaratishda xatolik yuz berdi."}${data.code ? ` (Kod: ${data.code})` : ""}`);
      }

      if (!data.text) {
        throw new Error("AI javobi bo‘sh qaytdi. Qayta urinib ko‘ring.");
      }

      setResult(data.text);
      if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ulanishda xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
    } catch {
      setError("Nusxalash imkoni bo‘lmadi. Matnni belgilab nusxalang.");
    }
  }

  if (authChecking) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 text-[#191923]"><p className="text-sm text-gray-500">Hisobingiz tekshirilmoqda...</p></main>;
  }

  if (!signedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 py-10 text-[#191923]">
        <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl shadow-violet-100/40">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-700">✳</div>
          <h1 className="mt-5 text-2xl font-black">IJOD AI’ga xush kelibsiz</h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">AI Matn vositasidan foydalanish uchun avval hisobingizga kiring yoki yangi hisob yarating.</p>
          <Link href="/login" className="mt-6 block rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-violet-700">Kirish yoki ro‘yxatdan o‘tish →</Link>
          <Link href="/" className="mt-4 block text-sm font-semibold text-gray-500 hover:text-violet-700">← Bosh sahifa</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-violet-700">
          ← Bosh sahifa
        </Link>

        <header className="mt-6 rounded-3xl bg-gradient-to-br from-[#191326] to-violet-900 p-8 text-white">
          <p className="text-xs font-bold tracking-widest text-violet-200">
            IJOD LABORATORIYASI
          </p>
          <h1 className="mt-3 text-3xl font-black">AI Matn</h1>
          <p className="mt-3 text-sm text-white/75">
            Post, reklama va Reels ssenariysi uchun tayyor matn yarating.
          </p>
          <p className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
            ✦ {credits === null ? "Kredit tekshirilmoqda..." : `${credits} kredit`}
          </p>
        </header>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
          <label className="block text-sm font-semibold">
            Matn turi
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"
            >
              <option>Instagram posti</option>
              <option>Reklama matni</option>
              <option>Reels ssenariysi</option>
              <option>Mahsulot tavsifi</option>
              <option>Kontent g‘oyalari</option>
            </select>
          </label>

          <label className="mt-5 block text-sm font-semibold">
            Mavzu yoki g‘oya
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Masalan: yangi mahsulot uchun Instagram posti..."
              className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal outline-none focus:border-violet-400"
            />
            <span className="mt-1 block text-right text-xs font-normal text-gray-400">
              {topic.length}/4000
            </span>
          </label>

          <label className="mt-5 block text-sm font-semibold">
            Matn ohangi
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"
            >
              <option>Samimiy</option>
              <option>Professional</option>
              <option>Ijodiy va qiziqarli</option>
            </select>
          </label>

          <button
            disabled={!topic.trim() || loading}
            onClick={generateText}
            className="mt-5 w-full rounded-xl bg-violet-600 p-3.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "AI matn yaratyapti..." : "✨ AI bilan matn yaratish"}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {result && (
            <section className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Tayyor matn</h2>
                <button
                  onClick={copyResult}
                  className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
                >
                  {copied ? "Nusxalandi ✓" : "Matnni nusxalash"}
                </button>
              </div>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-800">
                {result}
              </div>
            </section>
          )}

          <p className="mt-4 text-xs leading-5 text-gray-400">
            Har bir AI matn so‘rovi 1 kredit ishlatadi. Xatolik yuz bersa, kreditni qaytarishga harakat qilamiz.
          </p>
        </section>
      </div>
    </main>
  );
}
