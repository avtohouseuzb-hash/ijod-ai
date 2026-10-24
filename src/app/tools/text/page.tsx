"use client";

import Link from "next/link";
import { useState } from "react";

export default function TextToolPage() {
  const [kind, setKind] = useState("Instagram posti");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Samimiy");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateText() {
    if (!topic.trim()) return;

    setLoading(true);
    setError("");
    setResult("");
    setCopied(false);

    try {
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: kind, topic: topic.trim(), tone }),
      });

      const data: { text?: string; error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Matn yaratishda xatolik yuz berdi.");
      }

      if (!data.text) {
        throw new Error("AI javobi bo‘sh qaytdi. Qayta urinib ko‘ring.");
      }

      setResult(data.text);
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
            Matn OpenAI API orqali yaratiladi. API so‘rovlari balansdagi kreditdan
            foydalanadi.
          </p>
        </section>
      </div>
    </main>
  );
}
