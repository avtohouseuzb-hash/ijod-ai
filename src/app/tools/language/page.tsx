"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Mood = "neutral" | "kind" | "happy" | "angry" | "thinking" | "sleepy";
type Message = { role: "user" | "assistant"; content: string };
const moods: { id: Mood; label: string; face: string; color: string; note: string }[] = [
  { id: "neutral", label: "Neytral", face: "•‿•", color: "from-violet-100 to-white border-violet-200 text-violet-700", note: "xotirjam va aniq" },
  { id: "kind", label: "Mehribon", face: "♥‿♥", color: "from-pink-100 to-white border-pink-200 text-pink-600", note: "iliq va qo‘llab-quvvatlovchi" },
  { id: "happy", label: "Xursand", face: "✧ᴗ✧", color: "from-amber-100 to-white border-amber-200 text-amber-600", note: "quvnoq va motivatsion" },
  { id: "angry", label: "Qattiqqo‘l", face: "ಠ益ಠ", color: "from-red-100 to-white border-red-200 text-red-600", note: "talabchan, lekin hurmatli" },
  { id: "thinking", label: "O‘ylayapti", face: "•﹏•", color: "from-sky-100 to-white border-sky-200 text-sky-700", note: "mulohazali va tahliliy" },
  { id: "sleepy", label: "Dam olyapti", face: "－ᴗ－", color: "from-indigo-100 to-white border-indigo-200 text-indigo-600", note: "sekin va sokin" },
];
const personalities = [
  { id: "teacher", label: "Ustoz", desc: "Sabrli, tushuntirib o‘rgatadi", emoji: "🎓" },
  { id: "friend", label: "Do‘st", desc: "Tabiiy va erkin suhbat", emoji: "🤝" },
  { id: "strict", label: "Qattiqqo‘l ustoz", desc: "Talabchan, xatolarni ko‘rsatadi", emoji: "📚" },
  { id: "funny", label: "Hazilkash", desc: "O‘yin va hazil bilan o‘rgatadi", emoji: "😄" },
  { id: "kind", label: "Mehribon", desc: "Iliq va dalda beruvchi", emoji: "💗" },
  { id: "mentor", label: "Professional mentor", desc: "Ish va kasbiy muloqot", emoji: "💼" },
];

export default function LanguageTutorPage() {
  const [language, setLanguage] = useState("English");
  const [level, setLevel] = useState("A1");
  const [personality, setPersonality] = useState("teacher");
  const [topic, setTopic] = useState("Everyday conversation");
  const [mood, setMood] = useState<Mood>("neutral");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeMood = moods.find((item) => item.id === mood) ?? moods[0];

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/login"; return; }
    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/language-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ message: text, history: messages.slice(-12), language, level, personality, topic, mood }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Javob olishda xatolik yuz berdi.");
      setMessages((current) => [...current, { role: "assistant", content: data.text }]);
    } catch (err) {
      setMessages((current) => current.slice(0, -1));
      setInput(text);
      setError(err instanceof Error ? err.message : "Noma’lum xatolik.");
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-[#f7f7fb] text-gray-900">
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-violet-700">← IJOD AI</Link>
        <span className="text-sm font-bold">AI Ustoz</span>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">Language Tutor</span>
      </div>
    </header>
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
          <div className={"mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] border-4 bg-gradient-to-br text-3xl font-black shadow-lg transition-all duration-300 " + activeMood.color}>
            {activeMood.face}
          </div>
          <h1 className="mt-4 text-center text-xl font-black">AI Ustoz</h1>
          <p className="mt-1 text-center text-xs text-gray-500">Kayfiyat: {activeMood.label} · {activeMood.note}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {moods.map((item) => <button key={item.id} onClick={() => setMood(item.id)} className={"rounded-xl border p-2 text-center transition " + (mood === item.id ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100" : "border-gray-100 bg-white hover:border-violet-200")}>
              <span className={"mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-black " + item.color}>{item.face}</span>
              <span className="mt-1 block text-[10px] font-semibold">{item.label}</span>
            </button>)}
          </div>
        </section>
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Dars sozlamalari</h2>
          <label className="mt-4 block text-xs font-semibold text-gray-500">O‘rganiladigan til</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm"><option>English</option><option>Русский</option></select>
          <label className="mt-3 block text-xs font-semibold text-gray-500">Darajangiz</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm">{["A1","A2","B1","B2","C1"].map((v) => <option key={v}>{v}</option>)}</select>
          <label className="mt-3 block text-xs font-semibold text-gray-500">O‘qituvchi xarakteri</label>
          <select value={personality} onChange={(e) => setPersonality(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm">{personalities.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}</select>
          <label className="mt-3 block text-xs font-semibold text-gray-500">Suhbat mavzusi</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm">
            {["Everyday conversation","Travel","School & study","Business & finance","Medicine & healthcare","IT & technology","Work interview","Culture & art"].map((v) => <option key={v}>{v}</option>)}
          </select>
          <p className="mt-4 rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-800">AI xatolaringizni muloyim tuzatadi, yangi so‘zlarni tushuntiradi va darajangizga mos gaplashadi.</p>
        </section>
      </aside>
      <section className="flex min-h-[680px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4 sm:p-5">
          <div className={"flex h-12 w-12 items-center justify-center rounded-2xl border-2 bg-gradient-to-br text-lg font-black " + activeMood.color}>{activeMood.face}</div>
          <div className="min-w-0 flex-1"><h2 className="font-bold">AI Ustoz bilan suhbat</h2><p className="text-xs text-gray-500">{language} · {level} · {personalities.find((p) => p.id === personality)?.label}</p></div>
          <button onClick={() => { setMessages([]); setError(""); }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">Yangi dars</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-[#fcfbff] p-4 sm:p-6">
          {messages.length === 0 && <div className="mx-auto mt-12 max-w-md text-center">
            <div className={"mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] border-2 bg-gradient-to-br text-2xl font-black " + activeMood.color}>{activeMood.face}</div>
            <h3 className="mt-5 text-xl font-black">Salom! Men sizning AI Ustozingizman.</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">Bugun {language === "English" ? "ingliz" : "rus"} tilida gaplashamiz. O‘zingizni tanishtiring yoki quyidagi mavzulardan birini boshlang.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">{["Introduce yourself","My daily routine","At a restaurant"].map((v) => <button key={v} onClick={() => setInput(v)} className="rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">{v}</button>)}</div>
          </div>}
          {messages.map((message, index) => <div key={index} className={"flex " + (message.role === "user" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 " + (message.role === "user" ? "rounded-br-md bg-violet-600 text-white" : "rounded-bl-md border border-violet-100 bg-white text-gray-800 shadow-sm")}>{message.content}</div>
          </div>)}
          {loading && <div className="flex justify-start"><div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-700">AI Ustoz o‘ylayapti…</div></div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="border-t border-gray-100 bg-white p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-violet-300">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} rows={2} maxLength={2000} placeholder="Xabaringizni yozing..." className="max-h-32 min-h-12 flex-1 resize-y bg-transparent p-2 text-sm outline-none" />
            <button disabled={loading || !input.trim()} onClick={() => void sendMessage()} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">Yuborish ↑</button>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Har bir AI javobi 1 kredit sarflaydi. Suhbat tarixi ushbu dars oynasida saqlanadi.</p>
        </div>
      </section>
    </div>
  </main>;
}
