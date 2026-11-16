"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Summary = { calls: number; meteredCalls: number; unmeteredCalls: number; inputTokens: number; outputTokens: number; totalTokens: number };
type EventRow = { id: string; feature: string; model: string; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null; usage_available: boolean; created_at: string };
type UsageData = { creditTestMode: boolean; today: Summary; last30Days: Summary; recent: EventRow[]; truncated?: boolean };

const number = (value: number) => new Intl.NumberFormat("uz-UZ").format(value);

export default function AiUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        window.location.assign("/login");
        return;
      }
      const response = await fetch("/api/ai-usage", {
        headers: { Authorization: "Bearer " + session.access_token },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Statistikani yuklab bo‘lmadi.");
      setData(result as UsageData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noma’lum xatolik.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards = data ? [
    { title: "Bugun sarflangan token", value: data.today.totalTokens, sub: number(data.today.calls) + " ta AI so‘rovi" },
    { title: "Oxirgi 30 kun", value: data.last30Days.totalTokens, sub: number(data.last30Days.calls) + " ta AI so‘rovi" },
    { title: "Kirish tokenlari", value: data.last30Days.inputTokens, sub: "Input · 30 kun" },
    { title: "Chiqish tokenlari", value: data.last30Days.outputTokens, sub: "Output · 30 kun" },
  ] : [];

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">← IJOD AI bosh sahifasi</Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight">AI sarfi va tokenlar</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sizning akkauntingizda qayd etilgan AI so‘rovlari · Asia/Tashkent</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-violet-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {loading ? "Yangilanmoqda…" : "Yangilash"}
          </button>
        </div>

        {data?.creditTestMode && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span className="text-lg">✓</span>
            <div><p className="text-sm font-bold">Test rejimi yoqilgan</p><p className="mt-1 text-xs leading-5">AI funksiyalarini sinashda kreditlar yechilmaydi. Token sarfi esa alohida qayd qilinadi.</p></div>
          </div>
        )}

        {error && <div role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        {loading && !data ? <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Statistika yuklanmoqda…</div> : data && (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.title}</p>
                  <p className="mt-3 break-all text-2xl font-black tabular-nums">{number(item.value)}</p>
                  <p className="mt-2 text-[11px] text-slate-400">{item.sub}</p>
                </article>
              ))}
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Token hisoblangan so‘rovlar</p><p className="mt-2 text-xl font-black">{number(data.last30Days.meteredCalls)}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Token ma’lumoti berilmagan so‘rovlar</p><p className="mt-2 text-xl font-black">{number(data.last30Days.unmeteredCalls)}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs text-slate-500">Bugungi input / output</p><p className="mt-2 text-xl font-black">{number(data.today.inputTokens)} / {number(data.today.outputTokens)}</p></div>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="font-bold">So‘nggi AI so‘rovlari</h2>
                <p className="mt-1 text-xs text-slate-500">Token soni provayder qaytargan usage ma’lumotidan olinadi.</p>
              </div>
              {data.recent.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Hali token statistikasi yo‘q. AI xizmatidan foydalanganingizdan keyin shu yerda chiqadi.</p> : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recent.map((event) => (
                    <div key={event.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1.2fr_1fr_.8fr] sm:items-center">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{event.feature}</p><p className="mt-1 truncate text-[11px] text-slate-400">{event.model}</p></div>
                      <div className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", dateStyle: "medium", timeStyle: "short" })}</div>
                      <div className="text-left sm:text-right">{event.usage_available ? <><p className="text-sm font-black tabular-nums">{number(event.total_tokens ?? 0)} token</p><p className="mt-1 text-[10px] text-slate-400">In {number(event.input_tokens ?? 0)} · Out {number(event.output_tokens ?? 0)}</p></> : <p className="text-xs font-semibold text-amber-600">Token statistikasi mavjud emas</p>}</div>
                    </div>
                  ))}
                </div>
              )}
              {data.truncated && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 dark:border-slate-800">Juda ko‘p so‘rov bo‘lgani uchun faqat eng so‘nggi 2 000 tasi hisoblandi.</p>}
            </section>

            <p className="mt-4 text-xs leading-5 text-slate-400">Eslatma: rasm, audio va ayrim video xizmatlari token o‘rniga boshqa hisoblash birliklaridan foydalanadi. Provayder token sonini qaytarmasa, bu panel taxminiy token yozmaydi — bunday so‘rovni alohida belgilaydi.</p>
          </>
        )}
      </div>
    </main>
  );
}
