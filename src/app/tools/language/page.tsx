"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mood = "neutral" | "kind" | "happy" | "angry" | "thinking" | "sleepy";
type Message = { role: "user" | "assistant"; content: string };
type TutorLesson = { id: string; lesson_number: number; title: string; language: string; level: string; personality: string; topic: string; mood: Mood; messages: Message[]; status: "in_progress" | "completed"; updated_at: string };
type VoiceGender = "female" | "male" | "auto";
function toUzbekLatin(text: string) {
  const map: Record<string, string> = {
    "а":"a","б":"b","в":"v","г":"g","ғ":"gʻ","д":"d","е":"e","ё":"yo","ж":"j","з":"z","и":"i","й":"y","к":"k","қ":"q","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ў":"oʻ","ф":"f","х":"x","ҳ":"h","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ъ":"","ы":"i","ь":"","э":"e","ю":"yu","я":"ya",
    "ә":"a","і":"i","ң":"ng","ү":"ü","ұ":"u","ө":"o","һ":"h"
  };
  return text.replace(/[А-Яа-яЁёЎўҚқҒғҲҳЪъЬьЫыЭэЮюЯяӘәІіҢңҮүҰұӨөҺһ]/g, (char) => {
    const lower = char.toLowerCase();
    const value = map[lower] ?? char;
    if (char === char.toUpperCase() && char !== char.toLowerCase()) {
      return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
    }
    return value;
  });
}

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


function MoodAvatar({ mood, className = "", speakingLevel = 0 }: { mood: Mood; className?: string; speakingLevel?: number }) {
  const colors: Record<Mood, { bg: string; stroke: string; mouth: string }> = {
    neutral: { bg: "#F2EAFE", stroke: "#7837D8", mouth: "M32 44 Q40 50 48 44" },
    kind: { bg: "#FCE7F3", stroke: "#DB4B91", mouth: "M29 41 Q40 55 51 41" },
    happy: { bg: "#FEF3C7", stroke: "#D69A19", mouth: "M29 44 Q40 55 51 44" },
    angry: { bg: "#FEE2E2", stroke: "#DC3C3C", mouth: "M30 50 Q40 40 50 50" },
    thinking: { bg: "#E0F2FE", stroke: "#2584C7", mouth: "M30 45 Q35 40 40 45 T50 45" },
    sleepy: { bg: "#E0E7FF", stroke: "#6663C7", mouth: "M34 46 Q40 49 46 46" },
  };
  const c = colors[mood];
  const rootMoodClass = mood === "kind" ? "mood-avatar-kind" : "mood-avatar-" + mood;
  return <div className={"mood-avatar flex items-center justify-center rounded-[30%] border-[3px] shadow-sm transition-all duration-300 " + className} style={{ background: c.bg, borderColor: c.stroke }}>
    <svg viewBox="0 0 80 80" className={"h-[82%] w-[82%] mood-avatar-svg mood-face " + rootMoodClass} role="img" aria-label={moods.find((m) => m.id === mood)?.label || "AI Ustoz"}>
      {mood === "angry" && <path className="mood-brows" d="M18 25 L34 31 M62 25 L46 31" stroke={c.stroke} strokeWidth="5" strokeLinecap="round" />}
      {mood === "sleepy" ? <path className="mood-sleep-eyes" d="M19 34 Q27 40 35 34 M45 34 Q53 40 61 34" stroke="#25243A" strokeWidth="5" fill="none" strokeLinecap="round" /> : mood === "kind" ? <g className="mood-heart-eyes"><path d="M22 29 C16 22 7 32 22 43 C37 32 28 22 22 29Z M58 29 C52 22 43 32 58 43 C73 32 64 22 58 29Z" fill={c.stroke} /></g> : <g className="mood-eyes" fill="#25243A"><circle cx="26" cy="34" r="5"/><circle cx="54" cy="34" r="5"/></g>}
      {speakingLevel > 0.035 ? <ellipse className="mood-speaking-mouth" cx="40" cy="47" rx={3.5 + speakingLevel * 3.5} ry={2 + speakingLevel * 5} fill="#25243A" /> : <path className="mood-mouth" d={c.mouth} stroke="#25243A" strokeWidth="4.5" fill="none" strokeLinecap="round" />}
      {mood === "happy" && <g className="mood-sparkles" fill="#E8B43C"><path d="M12 17l2.2 4.8L19 24l-4.8 2.2L12 31l-2.2-4.8L5 24l4.8-2.2z M68 17l2.2 4.8L75 24l-4.8 2.2L68 31l-2.2-4.8L61 24l4.8-2.2z"/></g>}
      {mood === "angry" && <g className="mood-angry-accent" fill="#F87171"><path d="M8 10 L13 18 L21 20 L13 24 L8 32 L4 24 L0 20 L4 18Z M72 10 L76 18 L80 20 L76 24 L72 32 L68 24 L60 20 L68 18Z" opacity=".8"/></g>}
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
  const [lessons, setLessons] = useState<TutorLesson[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [lessonError, setLessonError] = useState("");
  const currentLessonIdRef = useRef<string | null>(null);
  const realtimePcRef = useRef<RTCPeerConnection | null>(null);
  const realtimeStreamRef = useRef<MediaStream | null>(null);
  const realtimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const realtimeAudioContextRef = useRef<AudioContext | null>(null);
  const realtimeAnalyserFrameRef = useRef<number | null>(null);
  const [mouthLevel, setMouthLevel] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [realtimeBusy, setRealtimeBusy] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState("");
  const [userSubtitle, setUserSubtitle] = useState("");
  const [assistantSubtitle, setAssistantSubtitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("female");

  const [autoSpeak, setAutoSpeak] = useState(false);
  const voiceFeaturesEnabled = true; // Voice features use the existing server-side OpenAI API key.
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [audioLoadingIndex, setAudioLoadingIndex] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [listening, setListening] = useState(false);
  const activeMood = moods.find((item) => item.id === mood) ?? moods[0];
  const avatarSpeakingLevel = realtimeActive && aiSpeaking ? Math.max(mouthLevel, 0.32) : 0;

  async function stopRealtime() {
    if (realtimeAnalyserFrameRef.current !== null) cancelAnimationFrame(realtimeAnalyserFrameRef.current);
    realtimeAnalyserFrameRef.current = null;
    void realtimeAudioContextRef.current?.close().catch(() => {});
    realtimeAudioContextRef.current = null;
    setMouthLevel(0);
    setAiSpeaking(false);
    realtimePcRef.current?.close();
    realtimePcRef.current = null;
    realtimeStreamRef.current?.getTracks().forEach((track) => track.stop());
    realtimeStreamRef.current = null;
    if (realtimeAudioRef.current) {
      realtimeAudioRef.current.pause();
      realtimeAudioRef.current.srcObject = null;
      realtimeAudioRef.current = null;
    }
    setRealtimeActive(false);
    setRealtimeBusy(false);
    setRealtimeStatus("Ovozli suhbat tugatildi.");
  }

  async function startRealtime() {
    if (realtimeBusy || realtimeActive) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setRealtimeStatus("Jonli ovoz uchun HTTPS va WebRTC qo‘llaydigan zamonaviy brauzer kerak.");
      return;
    }
    setRealtimeBusy(true);
    setRealtimeStatus("Mikrofon ruxsati kutilmoqda…");
    let stream: MediaStream | null = null;
    let pc: RTCPeerConnection | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tokenResponse = await fetch("/api/language-tutor/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ language, level, personality, topic, mood, voice: voiceGender }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Jonli ovoz sessiyasini ochib bo‘lmadi.");
      pc = new RTCPeerConnection();
      realtimePcRef.current = pc;
      realtimeStreamRef.current = stream;
      const audio = new Audio();
      audio.autoplay = true;
      realtimeAudioRef.current = audio;
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        audio.srcObject = remoteStream;
        void audio.play().catch(() => setRealtimeStatus("Ovoz chiqishi uchun sahifaga bir marta bosing."));
        // Measure the incoming AI voice itself so the avatar mouth follows real speech volume.
        try {
          const AudioContextCtor = window.AudioContext;
          const audioContext = new AudioContextCtor();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.72;
          const source = audioContext.createMediaStreamSource(remoteStream);
          source.connect(analyser);
          realtimeAudioContextRef.current = audioContext;
          const samples = new Uint8Array(analyser.fftSize);
          let frameCount = 0;
          const measureVoice = () => {
            analyser.getByteTimeDomainData(samples);
            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
              const normalized = (samples[i] - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / samples.length);
            const level = Math.max(0, Math.min(1, (rms - 0.006) * 22));
            if (frameCount++ % 4 === 0) setMouthLevel(level);
            realtimeAnalyserFrameRef.current = requestAnimationFrame(measureVoice);
          };
          void audioContext.resume().then(measureVoice).catch(() => setRealtimeStatus("Ovoz animatsiyasi uchun brauzer audio ruxsati kerak."));
        } catch {
          setRealtimeStatus("Ovoz ishlayapti, lekin avatar animatsiyasini boshlash imkoni bo‘lmadi.");
        }
      };
      stream.getTracks().forEach((track) => pc?.addTrack(track, stream!));
      const channel = pc.createDataChannel("oai-events");
      channel.onopen = () => {
        channel.send(JSON.stringify({ type: "response.create", response: { max_output_tokens: 1200, audio: { output: { voice: voiceGender === "male" ? "ash" : voiceGender === "auto" ? "marin" : "coral" } } } }));
      };
      channel.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "session.created" || payload.type === "session.updated") {
            setRealtimeStatus("Jonli suhbat ulandi. Bemalol gapiring.");
          } else if (payload.type === "input_audio_buffer.speech_started") {
            setMouthLevel(0);
            setUserSubtitle("");
            setRealtimeStatus("Siz gapiryapsiz…");
          } else if (payload.type === "conversation.item.input_audio_transcription.delta") {
            setUserSubtitle((current) => current + (payload.delta || ""));
          } else if (payload.type === "conversation.item.input_audio_transcription.completed") {
            if (payload.transcript) setUserSubtitle(payload.transcript);
          } else if (payload.type === "response.created") {
            setAssistantSubtitle("");
            setAiSpeaking(true);
            setRealtimeStatus("AI Ustoz javob bermoqda…");
          } else if (payload.type === "response.output_audio_transcript.delta") {
            setAssistantSubtitle((current) => current + (payload.delta || ""));
          } else if (payload.type === "response.output_audio_transcript.done") {
            if (payload.transcript) setAssistantSubtitle(payload.transcript);
          } else if (payload.type === "response.done") {
            setAiSpeaking(false);
            setMouthLevel(0);
            if (payload.response?.status === "incomplete") {
              const reason = payload.response?.status_details?.reason;
              setRealtimeStatus(reason === "max_output_tokens" ? "Javob uzunligi chegarasiga yetdi. Qisqaroq javob berishga qayta urinaman." : "Ovozli javob kutilmaganda tugadi. Qayta urinib ko‘ring.");
            } else {
              setRealtimeStatus("Javob tugadi. Tinglayapman.");
            }
          } else if (payload.type === "error") {
            setRealtimeStatus(payload.error?.message || "Ovozli suhbatda xatolik.");
          }
        } catch { /* Ignore non-JSON realtime events. */ }
      };
      pc.onconnectionstatechange = () => {
        if (pc?.connectionState === "connected") {
          setRealtimeActive(true);
          setRealtimeStatus("Jonli suhbat ulandi. Bemalol gapiring.");
        } else if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") {
          setRealtimeStatus("Ovozli aloqa uzildi. Qayta ulaning.");
          void stopRealtime();
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (pc.iceGatheringState !== "complete") {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("Ovozli aloqa uchun tarmoq ulanishi vaqtida tayyor bo‘lmadi. Qayta urinib ko‘ring.")), 12000);
          const checkIce = () => {
            if (pc?.iceGatheringState === "complete") {
              window.clearTimeout(timeout);
              pc.removeEventListener("icegatheringstatechange", checkIce);
              resolve();
            }
          };
          pc?.addEventListener("icegatheringstatechange", checkIce);
          checkIce();
        });
      }
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: "Bearer " + tokenData.value, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error("OpenAI ulanish xatosi (" + response.status + "): " + detail.slice(0, 240));
      }
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
      setRealtimeStatus("Ovozli aloqa o‘rnatilmoqda…");
    } catch (err) {
      pc?.close();
      stream?.getTracks().forEach((track) => track.stop());
      realtimePcRef.current = null;
      realtimeStreamRef.current = null;
      setRealtimeActive(false);
      setRealtimeStatus(err instanceof Error ? err.message : "Jonli ovozli suhbatni boshlashda xatolik.");
    } finally {
      setRealtimeBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadLessons() {
      setLessonsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLessonsLoading(false); return; }
      const { data, error } = await supabase.from("language_tutor_lessons").select("*").order("updated_at", { ascending: false });
      if (cancelled) return;
      if (error) setLessonError("Darslar tarixini yuklab bo‘lmadi.");
      else {
        const rows = (data || []) as TutorLesson[];
        setLessons(rows);
        const active = rows.find((lesson) => lesson.status === "in_progress");
        if (active) {
          setCurrentLessonId(active.id);
          currentLessonIdRef.current = active.id;
          setMessages(Array.isArray(active.messages) ? active.messages : []);
          setLanguage(active.language);
          setLevel(active.level);
          setPersonality(active.personality);
          setTopic(active.topic);
          setMood(active.mood || "neutral");
        }
      }
      setLessonsLoading(false);
    }
    void loadLessons();
    return () => { cancelled = true; };
  }, []);

  async function persistLesson(nextMessages: Message[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Darsni saqlash uchun tizimga kiring.");
    const existingId = currentLessonIdRef.current;
    if (existingId) {
      const { data, error } = await supabase.from("language_tutor_lessons")
        .update({ messages: nextMessages, updated_at: new Date().toISOString() })
        .eq("id", existingId).select("*").single();
      if (error) throw error;
      setLessons((current) => [data as TutorLesson, ...current.filter((item) => item.id !== existingId)].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)));
      return data as TutorLesson;
    }
    const { data: previous, error: previousError } = await supabase.from("language_tutor_lessons")
      .select("lesson_number").eq("user_id", session.user.id).order("lesson_number", { ascending: false }).limit(1);
    if (previousError) throw previousError;
    const lessonNumber = (previous?.[0]?.lesson_number || 0) + 1;
    const title = nextMessages.find((m) => m.role === "user")?.content.slice(0, 48) || "Yangi dars";
    const { data, error } = await supabase.from("language_tutor_lessons")
      .insert({ user_id: session.user.id, lesson_number: lessonNumber, title, language, level, personality, topic, mood, messages: nextMessages, status: "in_progress" })
      .select("*").single();
    if (error) throw error;
    currentLessonIdRef.current = data.id;
    setCurrentLessonId(data.id);
    setLessons((current) => [data as TutorLesson, ...current]);
    return data as TutorLesson;
  }

  function openLesson(lesson: TutorLesson) {
    currentLessonIdRef.current = lesson.id;
    setCurrentLessonId(lesson.id);
    setMessages(Array.isArray(lesson.messages) ? lesson.messages : []);
    setLanguage(lesson.language);
    setLevel(lesson.level);
    setPersonality(lesson.personality);
    setTopic(lesson.topic);
    setMood(lesson.mood || "neutral");
    setError("");
  }

  async function startNewLesson() {
    const id = currentLessonIdRef.current;
    if (id) {
      const { error } = await supabase.from("language_tutor_lessons")
        .update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) { setLessonError("Oldingi darsni yakunlab bo‘lmadi."); return; }
      setLessons((current) => current.map((lesson) => lesson.id === id ? { ...lesson, status: "completed" } : lesson));
    }
    currentLessonIdRef.current = null;
    setCurrentLessonId(null);
    setMessages([]);
    setError("");
    setInput("");
  }

  async function completeCurrentLesson() {
    await startNewLesson();
  }


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
      const completedMessages: Message[] = [...nextMessages, { role: "assistant", content: data.text }];
      setMessages(completedMessages);
      // A lesson-history write must never erase a successful AI reply.
      try {
        await persistLesson(completedMessages);
        setLessonError("");
      } catch (saveError) {
        const detail = saveError && typeof saveError === "object" && "message" in saveError
          ? String((saveError as { message: unknown }).message)
          : saveError instanceof Error ? saveError.message : String(saveError);
        console.error("Language lesson save failed:", detail);
        setLessonError("AI javob berdi, ammo dars tarixini saqlashda xatolik: " + detail);
      }
      if (autoSpeak && voiceFeaturesEnabled) void speak(data.text, completedMessages.length - 1);
    } catch (err) {
      setMessages(nextMessages);
      setInput(text);
      const detail = err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error ? err.message : String(err);
      setError(detail || "AI bilan bog‘lanishda noma’lum xatolik.");
    } finally { setLoading(false); }
  }

  return (realtimeActive || realtimeBusy) ? <main className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-[#fbf9ff] to-[#f1edff] text-gray-900">
    <header className="flex shrink-0 items-center justify-between px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-2">
      <button onClick={() => void stopRealtime()} aria-label="Ovozli suhbatdan chiqish" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-gray-700 shadow-sm">×</button>
      <label className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-violet-800 shadow-sm">
        <span>Ovoz</span>
        <select aria-label="AI ovozini almashtirish" value={voiceGender} onChange={(e) => setVoiceGender(e.target.value as VoiceGender)} className="max-w-[92px] bg-transparent text-xs outline-none">
          <option value="female">Ayol</option><option value="male">Erkak</option><option value="auto">Avto</option>
        </select>
      </label>
    </header>
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="relative flex items-center justify-center">
        <div className={"absolute inset-[-22px] rounded-full border-[3px] border-violet-300 transition-all duration-150 " + (aiSpeaking ? "scale-110 opacity-90 animate-pulse" : "scale-100 opacity-35")} />
        <MoodAvatar mood={mood} speakingLevel={avatarSpeakingLevel} className="h-48 w-48 !rounded-full border-4 shadow-xl sm:h-56 sm:w-56" />
      </div>
      <p className="text-xs font-medium text-violet-700">{realtimeStatus || "Ovozli suhbatga ulanmoqda…"}</p>
      <div className="w-full max-w-xl rounded-3xl border border-violet-200 bg-white/95 p-4 shadow-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Jonli subtitrlar</p>
        <div className="max-h-[32vh] space-y-3 overflow-y-auto break-words text-[15px] leading-6 [overflow-wrap:anywhere]">
          {userSubtitle && <p><span className="font-bold text-gray-500">Sen:</span> {toUzbekLatin(userSubtitle)}</p>}
          {assistantSubtitle && <p><span className="font-bold text-violet-700">AI Ustoz:</span> {toUzbekLatin(assistantSubtitle)}</p>}
          {!userSubtitle && !assistantSubtitle && <p className="text-gray-400">Suhbat boshlanishini kutyapman…</p>}
        </div>
      </div>
    </div>
  </main> : <main className="min-h-screen bg-[#f7f7fb] text-gray-900">
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
          <MoodAvatar mood={mood} speakingLevel={realtimeActive ? mouthLevel : 0} className="mx-auto h-28 w-28" />
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
          <div className="flex items-center justify-between"><h2 className="font-bold">Mening darslarim</h2><button onClick={startNewLesson} className="text-xs font-bold text-violet-700">+ Yangi</button></div>
          <p className="mt-1 text-xs text-gray-500">Darslar avtomatik saqlanadi.</p>
          {lessonError && <p className="mt-2 text-xs text-red-600">{lessonError}</p>}
          {lessonsLoading ? <p className="mt-3 text-xs text-gray-400">Darslar yuklanmoqda…</p> : lessons.length === 0 ? <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">Hozircha darslar yo‘q. Birinchi darsni boshlang.</p> :
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {lessons.map((lesson) => <button key={lesson.id} onClick={() => openLesson(lesson)} className={"w-full rounded-xl border p-3 text-left transition " + (currentLessonId === lesson.id ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:border-violet-200")}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">{lesson.lesson_number}-dars · {lesson.title}</span><span className={"shrink-0 text-[10px] " + (lesson.status === "completed" ? "text-green-600" : "text-violet-600")}>{lesson.status === "completed" ? "Tugallangan" : "Davom etmoqda"}</span></div>
                <p className="mt-1 text-[10px] text-gray-500">{lesson.language} · {lesson.level} · {new Date(lesson.updated_at).toLocaleDateString()}</p>
              </button>)}
            </div>}
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
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] leading-4 text-amber-800">Ovozli AI faol. Mikrofon transkripsiyasi va tabiiy ovoz OpenAI API orqali ishlaydi; foydalanish hajmiga qarab API hisobingizdan haq olinadi.</p>
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
          <MoodAvatar mood={mood} speakingLevel={realtimeActive ? mouthLevel : 0} className="h-12 w-12" />
          <div className="min-w-0 flex-1"><h2 className="font-bold">{language === "English" ? "Chat with AI Tutor" : "Разговор с AI-учителем"}</h2><p className="text-xs text-gray-500">{language} · {level} · {personalities.find((p) => p.id === personality)?.label}</p></div>
          <button onClick={completeCurrentLesson} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">{currentLessonId ? "Darsni yakunlash" : "Yangi dars"}</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-[#fcfbff] p-4 sm:p-6">
          {messages.length === 0 && <div className="mx-auto mt-12 max-w-md text-center">
            <MoodAvatar mood={mood} speakingLevel={realtimeActive ? mouthLevel : 0} className="mx-auto h-20 w-20" />
            <h3 className="mt-5 text-xl font-black">Salom! Men sizning AI Ustozingizman.</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">{language === "English" ? "Today we will practise English. Choose a topic or write your own message." : "Сегодня мы будем практиковать русский язык. Выберите тему или напишите своё сообщение."}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">{(language === "English" ? ["Introduce yourself","My daily routine","At a restaurant"] : ["Расскажите о себе","Мой распорядок дня","В ресторане"]).map((v) => <button key={v} onClick={() => setInput(v)} className="rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">{v}</button>)}</div>
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
        <div className="w-full min-w-0 border-t border-violet-100 bg-violet-50/60 px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="w-full min-w-0">
              <p className="text-sm font-bold text-violet-900">Jonli ovozli suhbat</p>
              <p className="mt-1 text-xs text-violet-700">{realtimeStatus || "AI Ustoz bilan yozmasdan, bevosita gaplashing."}</p>
            </div>
            {(userSubtitle || assistantSubtitle) && <div className="block w-full max-w-full min-w-0 rounded-xl border border-violet-200 bg-white p-3 sm:p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Jonli subtitrlar</p>
              <div className="w-full max-h-44 space-y-3 overflow-y-auto break-words text-sm leading-6 [overflow-wrap:anywhere]">
                {userSubtitle && <p><span className="font-semibold text-gray-500">Siz:</span> {toUzbekLatin(userSubtitle)}</p>}
                {assistantSubtitle && <p><span className="font-semibold text-violet-700">AI Ustoz:</span> {toUzbekLatin(assistantSubtitle)}</p>}
              </div>
            </div>}
            <div className="flex justify-end">
              {realtimeActive ? <button onClick={() => void stopRealtime()} className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white sm:w-auto">Suhbatni tugatish ■</button> : <button disabled={realtimeBusy} onClick={() => void startRealtime()} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto">{realtimeBusy ? "Ulanmoqda…" : "🎙 Jonli suhbatni boshlash"}</button>}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-violet-600">OpenAI Realtime API ishlatiladi. Mikrofon ruxsati va internet kerak; audio foydalanishi API hisobingizda alohida narxlanadi.</p>
        </div>
        <div className="border-t border-gray-100 bg-white p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-violet-300">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} rows={2} maxLength={2000} placeholder={language === "English" ? "Write your message..." : "Напишите ваше сообщение..."} className="max-h-32 min-h-12 flex-1 resize-y bg-transparent p-2 text-sm outline-none" />
            <button type="button" disabled={loading || transcribing} onClick={() => listening ? stopMicrophone() : void startMicrophone()} title={listening ? "Yozuvni tugatish" : "Mikrofon orqali gapirish"} aria-label="Mikrofon" className={"flex min-w-[52px] items-center justify-center gap-1 rounded-xl border px-3 py-3 text-lg font-bold transition " + (listening ? "border-red-300 bg-red-50 text-red-600 animate-pulse" : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100")}><span>🎙️</span><span className="text-xs">{listening ? "STOP" : "Gapir"}</span></button>
            <button disabled={loading || !input.trim()} onClick={() => void sendMessage()} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{language === "English" ? "Send ↑" : "Отправить ↑"}</button>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Mikrofon: gapirishni boshlash va tugatish uchun tugmani bosing. Audio OpenAI orqali matnga aylantiriladi. Tabiiy ovoz OpenAI API orqali yaratiladi (alohida API xarajati bor); AI ovozi ekanligi foydalanuvchiga oshkor qilinadi. Emoji va format belgilari o‘qilmaydi.</p>
        </div>
      </section>
    </div>
  </main>;
}
