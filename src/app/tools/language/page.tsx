"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mood = "neutral" | "kind" | "happy" | "angry" | "thinking" | "sleepy";
type Message = { role: "user" | "assistant"; content: string };
type VoiceGender = "female" | "male" | "auto";
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


function MoodAvatar({ mood, className = "" }: { mood: Mood; className?: string }) {
  const colors: Record<Mood, { bg: string; stroke: string; mouth: string }> = {
    neutral: { bg: "#F2EAFE", stroke: "#7837D8", mouth: "M32 44 Q40 50 48 44" },
    kind: { bg: "#FCE7F3", stroke: "#DB4B91", mouth: "M29 41 Q40 55 51 41" },
    happy: { bg: "#FEF3C7", stroke: "#D69A19", mouth: "M27 39 Q40 58 53 39" },
    angry: { bg: "#FEE2E2", stroke: "#DC3C3C", mouth: "M30 50 Q40 40 50 50" },
    thinking: { bg: "#E0F2FE", stroke: "#2584C7", mouth: "M34 46 Q40 42 47 45" },
    sleepy: { bg: "#E0E7FF", stroke: "#6663C7", mouth: "M34 46 Q40 49 46 46" },
  };
  const c = colors[mood];
  return <div className={"flex items-center justify-center rounded-[30%] border-[3px] shadow-sm transition-all duration-300 " + className} style={{ background: c.bg, borderColor: c.stroke }}>
    <svg viewBox="0 0 80 80" className="h-[82%] w-[82%]" role="img" aria-label={moods.find((m) => m.id === mood)?.label || "AI Ustoz"}>
      {mood === "angry" && <path d="M18 25 L34 31 M62 25 L46 31" stroke={c.stroke} strokeWidth="5" strokeLinecap="round" />}
      {mood === "sleepy" ? <path d="M19 34 Q27 40 35 34 M45 34 Q53 40 61 34" stroke="#25243A" strokeWidth="5" fill="none" strokeLinecap="round" /> : mood === "kind" ? <><path d="M22 29 C16 22 7 32 22 43 C37 32 28 22 22 29Z M58 29 C52 22 43 32 58 43 C73 32 64 22 58 29Z" fill={c.stroke} /></> : <><circle cx="26" cy="34" r="5" fill="#25243A" /><circle cx="54" cy="34" r="5" fill="#25243A" /></>}
      <path d={c.mouth} stroke="#25243A" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      {mood === "happy" && <path d="M12 12 L16 6 L20 12 L26 16 L20 20 L16 26 L12 20 L6 16Z M60 12 L64 6 L68 12 L74 16 L68 20 L64 26 L60 20 L54 16Z" fill="#E8B43C" />}
      {mood === "angry" && <path d="M8 10 L13 18 L21 20 L13 24 L8 32 L4 24 L0 20 L4 18Z M72 10 L76 18 L80 20 L76 24 L72 32 L68 24 L60 20 L68 18Z" fill="#F87171" opacity=".8" />}
    </svg>
  </div>;
}

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
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("female");

  const [autoSpeak, setAutoSpeak] = useState(false);
  const voiceFeaturesEnabled = false; // Paid audio APIs remain disabled under the free-budget constraint.
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [audioLoadingIndex, setAudioLoadingIndex] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [listening, setListening] = useState(false);
  const activeMood = moods.find((item) => item.id === mood) ?? moods[0];

  useEffect(() => () => {
    activeAudioRef.current?.pause();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }, []);


  function cleanSpeechText(value: string) {
    return value
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\p{Extended_Pictographic}/gu, " ")
      .replace(/[\uFE0F\u200D]/g, "")
      .replace(/[*_~`#>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function transcribeRecording(blob: Blob) {
    if (blob.size < 1500) { setVoiceNotice("Ovoz juda qisqa yozildi. Qayta urinib ko‘ring."); return; }
    setTranscribing(true);
    setVoiceNotice("Nutqingiz matnga aylantirilmoqda…");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("language", language);
      const response = await fetch("/api/language-tutor/transcribe", { method: "POST", headers: { Authorization: "Bearer " + session.access_token }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nutqni matnga aylantirib bo‘lmadi.");
      setInput((current) => (current ? current.trimEnd() + " " : "") + data.text);
      setVoiceNotice("Nutqingiz yozildi. Yuborishdan oldin tekshiring.");
    } catch (err) { setVoiceNotice(err instanceof Error ? err.message : "Mikrofon xatosi."); }
    finally { setTranscribing(false); }
  }

  async function startMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceNotice("Mikrofon bu brauzerda ishlamaydi. HTTPS orqali Chrome yoki Safari'da oching."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onerror = () => { setListening(false); stream.getTracks().forEach((track) => track.stop()); setVoiceNotice("Mikrofon yozuvida xatolik."); };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        void transcribeRecording(audioBlob);
      };
      recorder.start();
      setListening(true);
      setVoiceNotice("Yozilmoqda. Tugatish uchun mikrofonni yana bosing.");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setVoiceNotice(name === "NotAllowedError" ? "Mikrofon ruxsati berilmadi. Brauzer sozlamasidan ruxsat bering." : "Mikrofonni ishga tushirib bo‘lmadi.");
    }
  }

  function stopMicrophone() {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }
  async function speak(text: string, index: number) {
    const spokenText = cleanSpeechText(text);
    if (!spokenText) return;
    setAudioLoadingIndex(index);
    setVoiceNotice("Tabiiy AI ovozi tayyorlanmoqda…");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      const response = await fetch("/api/language-tutor/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({
          text: spokenText,
          voice: voiceGender === "female" ? "coral" : voiceGender === "male" ? "ash" : "marin",
          language,
          mood,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Tabiiy ovoz yaratilmadi.");
      }
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      activeAudioRef.current?.pause();
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.onended = () => { setSpeakingIndex(null); URL.revokeObjectURL(audioUrl); };
      audio.onerror = () => { setSpeakingIndex(null); URL.revokeObjectURL(audioUrl); setVoiceNotice("Audio ijro etilmadi."); };
      setSpeakingIndex(index);
      setVoiceNotice("OpenAI tabiiy AI ovozi · " + (voiceGender === "female" ? "Coral" : voiceGender === "male" ? "Ash" : "Marin"));
      await audio.play();
    } catch (err) {
      setVoiceNotice(err instanceof Error ? err.message : "Ovoz yaratishda xatolik.");
    } finally { setAudioLoadingIndex(null); }
  }

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
      setMessages((current) => [...current, { role: "assistant" as const, content: data.text }]);
      if (autoSpeak && voiceFeaturesEnabled) void speak(data.text, messages.length + 1);
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
          <MoodAvatar mood={mood} className="mx-auto h-28 w-28" />
          <h1 className="mt-4 text-center text-xl font-black">AI Ustoz</h1>
          <p className="mt-1 text-center text-xs text-gray-500">Kayfiyat: {activeMood.label} · {activeMood.note}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {moods.map((item) => <button key={item.id} onClick={() => setMood(item.id)} className={"rounded-xl border p-2 text-center transition " + (mood === item.id ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100" : "border-gray-100 bg-white hover:border-violet-200")}>
              <MoodAvatar mood={item.id} className="mx-auto h-10 w-10" />
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
          <label className="mt-3 block text-xs font-semibold text-gray-500">Ovoz turi</label>
          <select value={voiceGender} disabled={!voiceFeaturesEnabled} onChange={(e) => setVoiceGender(e.target.value as VoiceGender)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-100 p-3 text-sm text-gray-500 disabled:cursor-not-allowed"><option value="female">Ayol ovozi</option><option value="male">Erkak ovozi</option><option value="auto">Avtomatik ovoz</option></select>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-500"><input type="checkbox" checked={autoSpeak} disabled={!voiceFeaturesEnabled} onChange={(e) => setAutoSpeak(e.target.checked)} className="accent-violet-600 disabled:opacity-50" /> AI javobini avtomatik ovoz chiqarib o‘qish</label>
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] leading-4 text-amber-800">Ovozli AI hozircha o‘chirilgan. Tabiiy ovoz va nutqni matnga aylantirish OpenAI audio API xarajatini talab qiladi. Bepul budjet cheklovi sababli mikrofon transkripsiyasi va ovoz ijrosi faollashtirilmagan.</p>
          {voiceNotice && <p className="mt-2 rounded-lg bg-violet-50 p-2 text-[11px] leading-4 text-violet-700">{voiceNotice}</p>}
          <label className="mt-3 block text-xs font-semibold text-gray-500">Suhbat mavzusi</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm">
            {["Everyday conversation","Travel","School & study","Business & finance","Medicine & healthcare","IT & technology","Work interview","Culture & art"].map((v) => <option key={v}>{v}</option>)}
          </select>
          <p className="mt-4 rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-800">AI xatolaringizni muloyim tuzatadi, yangi so‘zlarni tushuntiradi va darajangizga mos gaplashadi.</p>
        </section>
      </aside>
      <section className="flex min-h-[680px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4 sm:p-5">
          <MoodAvatar mood={mood} className="h-12 w-12" />
          <div className="min-w-0 flex-1"><h2 className="font-bold">AI Ustoz bilan suhbat</h2><p className="text-xs text-gray-500">{language} · {level} · {personalities.find((p) => p.id === personality)?.label}</p></div>
          <button onClick={() => { setMessages([]); setError(""); }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">Yangi dars</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-[#fcfbff] p-4 sm:p-6">
          {messages.length === 0 && <div className="mx-auto mt-12 max-w-md text-center">
            <MoodAvatar mood={mood} className="mx-auto h-20 w-20" />
            <h3 className="mt-5 text-xl font-black">Salom! Men sizning AI Ustozingizman.</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">Bugun {language === "English" ? "ingliz" : "rus"} tilida gaplashamiz. O‘zingizni tanishtiring yoki quyidagi mavzulardan birini boshlang.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">{["Introduce yourself","My daily routine","At a restaurant"].map((v) => <button key={v} onClick={() => setInput(v)} className="rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">{v}</button>)}</div>
          </div>}
          {messages.map((message, index) => <div key={index} className={"flex " + (message.role === "user" ? "justify-end" : "justify-start")}>
            <div className={"max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 " + (message.role === "user" ? "rounded-br-md bg-violet-600 text-white" : "rounded-bl-md border border-violet-100 bg-white text-gray-800 shadow-sm")}>
              {message.content}
              {message.role === "assistant" && <button onClick={() => { if (speakingIndex === index) { activeAudioRef.current?.pause(); setSpeakingIndex(null); } else void speak(message.content, index); }} disabled={audioLoadingIndex === index} className="mt-3 flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50">{audioLoadingIndex === index ? "Ovoz tayyorlanmoqda…" : speakingIndex === index ? "To‘xtatish ■" : "Tabiiy ovozda eshitish 🔊"}</button>}
            </div>
          </div>)}
          {loading && <div className="flex justify-start"><div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-700">AI Ustoz o‘ylayapti…</div></div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="border-t border-gray-100 bg-white p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-violet-300">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} rows={2} maxLength={2000} placeholder="Xabaringizni yozing..." className="max-h-32 min-h-12 flex-1 resize-y bg-transparent p-2 text-sm outline-none" />
            <button type="button" disabled={loading || transcribing} onClick={() => listening ? stopMicrophone() : void startMicrophone()} title={listening ? "Yozuvni tugatish" : "Mikrofon orqali gapirish"} aria-label="Mikrofon" className={"flex min-w-[52px] items-center justify-center gap-1 rounded-xl border px-3 py-3 text-lg font-bold transition " + (listening ? "border-red-300 bg-red-50 text-red-600 animate-pulse" : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100")}><span>🎙️</span><span className="text-xs">{listening ? "STOP" : "Gapir"}</span></button>
            <button disabled={loading || !input.trim()} onClick={() => void sendMessage()} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">Yuborish ↑</button>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Mikrofon: gapirishni boshlash va tugatish uchun tugmani bosing. Audio OpenAI orqali matnga aylantiriladi. Tabiiy ovoz OpenAI API orqali yaratiladi (alohida API xarajati bor); AI ovozi ekanligi foydalanuvchiga oshkor qilinadi. Emoji va format belgilari o‘qilmaydi.</p>
        </div>
      </section>
    </div>
  </main>;
}
