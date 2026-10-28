"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;

        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMessage("Ro‘yxatdan o‘tish boshlandi. Emailingizga tasdiqlash xati yuborilgan bo‘lsa, pochtangizni tekshiring.");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma’lum xatolik yuz berdi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 py-10 text-[#191923]">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="IJOD AI bosh sahifasi" className="mb-8 flex flex-col items-center justify-center gap-1">
          <img src="/ijod-logo-v2.svg?v=4" alt="IJOD AI logotipi" className="h-auto w-[180px] object-contain" />
          <span className="text-[10px] tracking-[.2em] text-gray-400">CREATIVE SUPERAPP</span>
        </Link>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-violet-100/40 sm:p-8">
          <div className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">Xush kelibsiz</div>
          <h1 className="mt-2 text-2xl font-bold">{mode === "login" ? "Hisobingizga kiring" : "Hisob yarating"}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {mode === "login" ? "IJOD AI vositalaridan foydalanishni davom ettiring." : "IJOD AI bilan ijod qilishni boshlang."}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm">
            <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} className={`rounded-lg px-3 py-2.5 font-semibold transition ${mode === "login" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500"}`}>Kirish</button>
            <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className={`rounded-lg px-3 py-2.5 font-semibold transition ${mode === "signup" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500"}`}>Ro‘yxatdan o‘tish</button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Email</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="siz@example.com" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Parol</span>
              <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kamida 6 ta belgi" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
            </label>

            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm leading-5 text-emerald-800">{message}</p>}

            <button disabled={busy} type="submit" className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? "Kuting..." : mode === "login" ? "Kirish →" : "Hisob yaratish →"}
            </button>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-gray-400">Davom etish orqali hisobingiz uchun xavfsiz kirishdan foydalanasiz.</p>
        </section>

        <Link href="/" className="mt-6 block text-center text-sm font-medium text-gray-500 transition hover:text-violet-700">← Bosh sahifaga qaytish</Link>
      </div>
    </main>
  );
}
