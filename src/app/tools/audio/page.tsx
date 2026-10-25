"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const accents = [
  { id: "uz-neutral", name: "O‘zbekcha — tabiiy, neytral" },
  { id: "uz-tashkent", name: "O‘zbekcha — Toshkentga yaqin talaffuz" },
  { id: "uz-turkic", name: "O‘zbekcha — yumshoq turkiy ohang" },
];

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
  { id: "marin", name: "Marin", detail: "Tabiiy va ravon" },
  { id: "cedar", name: "Cedar", detail: "Aniq va chuqur" },
];

export default function AudioToolPage() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("marin");
  const [accent, setAccent] = useState("uz-neutral");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [extractedUrl, setExtractedUrl] = useState("");
  const [extractedBlob, setExtractedBlob] = useState<Blob | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
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


  async function previewVoice() {
    if (previewLoading) return;
    setPreviewLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Avval hisobingizga kiring.");
      const response = await fetch("/api/preview-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ voice, accent }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Ovoz namunasi tayyorlanmadi.");
      }
      const url = URL.createObjectURL(await response.blob());
      const player = new Audio(url);
      player.onended = () => URL.revokeObjectURL(url);
      await player.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ovoz namunasini eshitib bo‘lmadi.");
    } finally { setPreviewLoading(false); }
  }

  async function extractVideoAudio(file?: File) {
    setVideoError("");
    if (extractedUrl) URL.revokeObjectURL(extractedUrl);
    setExtractedUrl("");
    setExtractedBlob(null);
    if (!file) return;
    if (!file.type.startsWith("video/")) { setVideoError("Iltimos, video fayl tanlang."); return; }
    if (file.size > 200 * 1024 * 1024) { setVideoError("Video hajmi 200 MB dan oshmasin."); return; }
    setVideoLoading(true);
    let videoUrl = "";
    let video: HTMLVideoElement | null = null;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    try {
      videoUrl = URL.createObjectURL(file);
      video = document.createElement("video");
      video.src = videoUrl; video.muted = true; video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        video!.onloadedmetadata = () => resolve();
        video!.onerror = () => reject(new Error("Videoni ochib bo‘lmadi. Boshqa formatda urinib ko‘ring."));
      });
      const capture = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
      stream = (capture.captureStream?.() ?? capture.mozCaptureStream?.()) ?? null;
      if (!stream || stream.getAudioTracks().length === 0) throw new Error("Brauzer video ovozini ajrata olmadi yoki videoda ovoz yo‘q. Chrome/Edge brauzerida urinib ko‘ring.");
      const mimeType = ["audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Brauzer audio yozishni qo‘llab-quvvatlamaydi.");
      const audioOnly = new MediaStream(stream.getAudioTracks());
      const chunks: BlobPart[] = [];
      recorder = new MediaRecorder(audioOnly, { mimeType });
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder!.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder!.onerror = () => reject(new Error("Ovoz ajratishda xatolik yuz berdi."));
      });
      recorder.start();
      await video.play();
      await new Promise<void>((resolve, reject) => {
        video!.onended = () => resolve();
        video!.onerror = () => reject(new Error("Video ijrosi uzildi."));
      });
      recorder.stop();
      const audioBlob = await finished;
      if (!audioBlob.size) throw new Error("Videodan audio olinmadi.");
      setExtractedBlob(audioBlob);
      setExtractedUrl(URL.createObjectURL(audioBlob));
    } catch (err) {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      setVideoError(err instanceof Error ? err.message : "Ovoz ajratishda xatolik yuz berdi.");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoLoading(false);
    }
  }

  async function downloadExtractedAudio() {
    if (!extractedBlob || downloadLoading) return;
    setDownloadLoading(true);
    setVideoError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Yuklab olish uchun avval hisobingizga kiring.");
      const form = new FormData();
      form.append("audio", extractedBlob, "ijod-ai-video-audio.webm");
      const response = await fetch("/api/download-extracted-audio", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
        body: form,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Audio yuklab olinmadi.");
      }
      const resultBlob = await response.blob();
      const url = URL.createObjectURL(resultBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ijod-ai-video-audio.webm";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const remaining = response.headers.get("X-Remaining-Credits");
      if (remaining && Number.isFinite(Number(remaining))) setCredits(Number(remaining));
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Audio yuklab olishda xatolik yuz berdi.");
    } finally {
      setDownloadLoading(false);
    }
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
        body: JSON.stringify({ text: text.trim(), voice, accent }),
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
          <label className="mt-5 block text-sm font-semibold">
            Talaffuz uslubi
            <select value={accent} onChange={(e) => setAccent(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3">
              {accents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs leading-5 text-gray-400">Bu sozlama AI’ga o‘zbekcha talaffuzni yo‘naltiradi; alohida yozib olingan o‘zbek ovozi emas, natija farq qilishi mumkin.</p>
          <button type="button" disabled={previewLoading} onClick={previewVoice} className="mt-3 w-full rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-bold text-violet-800 disabled:opacity-50">
            {previewLoading ? "Namuna tayyorlanmoqda..." : "▶ " + (voices.find((item) => item.id === voice)?.name ?? "Tanlangan") + " ovozini eshitib ko‘rish"}
          </button>
          <p className="mt-2 text-xs text-gray-400">Ovoz namunasi IJOD AI kreditini olmaydi, ammo OpenAI API sarfi bo‘lishi mumkin.</p>

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
        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-black">Videodan ovoz ajratish</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Video faylni tanlang — faqat ovoz yo‘li ajratiladi. Ishlash vaqtida video to‘liq ijro etiladi.</p>
          <label className="mt-4 block text-sm font-semibold">Video fayl (200 MB gacha)
            <input type="file" accept="video/*,.mp4,.mov,.webm,.mkv" disabled={videoLoading} onChange={(e) => void extractVideoAudio(e.target.files?.[0])} className="mt-2 block w-full rounded-xl border border-gray-200 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-2 file:font-semibold file:text-violet-800" />
          </label>
          {videoLoading && <p className="mt-3 text-sm text-violet-700">Video ijro etilmoqda, ovoz ajratilyapti…</p>}
          {videoError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{videoError}</p>}
          {extractedUrl && <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <h3 className="font-bold">Ajratilgan ovoz</h3>
            <audio controls src={extractedUrl} className="mt-3 w-full">Brauzeringiz audio ijrosini qo‘llab-quvvatlamaydi.</audio>
            <button type="button" disabled={downloadLoading || !extractedBlob} onClick={downloadExtractedAudio} className="mt-3 inline-flex rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">{downloadLoading ? "Kredit tekshirilmoqda..." : "⬇ Audio faylni yuklab olish (1 kredit)"}</button>
          </div>}
        </section>
      </div>
    </main>
  );
}
