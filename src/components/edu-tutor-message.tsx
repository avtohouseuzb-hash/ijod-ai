"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type EduTutorVideo = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  url: string;
};

export type EduTutorMessageData = {
  id: string;
  role: "student" | "system";
  text: string;
  imageDataUrl?: string;
  videos?: EduTutorVideo[];
  youtubeSearchUrl?: string;
};

export default function EduTutorMessage({ message }: { message: EduTutorMessageData }) {
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioError, setAudioError] = useState("");

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function makeSpeech() {
    if (audioBusy) return;
    setAudioBusy(true);
    setAudioError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Ovozli tinglash uchun avval hisobingizga kiring.");
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ text: message.text.slice(0, 3900), voice: "coral", accent: "uz-neutral" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Ovoz yaratilmadi.");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("Audio fayl bo‘sh.");
      const nextUrl = URL.createObjectURL(blob);
      setAudioUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "Ovoz yaratishda xatolik.");
    } finally {
      setAudioBusy(false);
    }
  }

  if (message.role === "student") {
    return (
      <div className="ml-auto max-w-[92%] rounded-2xl bg-violet-600 px-4 py-3 text-xs leading-5 text-white">
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        {message.imageDataUrl && <img src={message.imageDataUrl} alt="O‘quvchi yuborgan rasm" className="mt-3 max-h-56 max-w-full rounded-xl border border-white/30 object-contain" />}
      </div>
    );
  }

  return (
    <article className="mr-auto w-full max-w-[98%] rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-xs leading-6 text-slate-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-violet-600">AI USTOZ</p>
        <button type="button" onClick={makeSpeech} disabled={audioBusy} className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50">
          <span aria-hidden="true">🔊</span>{audioBusy ? "Ovoz tayyorlanmoqda…" : "Tinglash"}
        </button>
      </div>
      <p className="whitespace-pre-wrap break-words">{message.text}</p>
      {audioUrl && <audio controls autoPlay src={audioUrl} className="mt-3 h-9 w-full" />}
      {audioError && <p role="alert" className="mt-2 text-[10px] text-rose-600">{audioError}</p>}
      {message.videos && message.videos.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-100 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-700"><span className="text-red-600">▶</span> Mavzuga mos videolar</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {message.videos.map((video) => (
              <a key={video.id} href={video.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-slate-100 bg-white transition hover:border-red-200">
                {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="aspect-video w-full object-cover" loading="lazy" />}
                <span className="block p-2.5"><span className="block text-[11px] font-bold leading-4 text-slate-800 group-hover:text-red-600">{video.title}</span><span className="mt-1 block text-[10px] text-slate-400">{video.channelTitle}</span></span>
              </a>
            ))}
          </div>
        </div>
      )}
      {message.youtubeSearchUrl && (!message.videos || message.videos.length === 0) && (
        <a href={message.youtubeSearchUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2.5 text-[10px] font-bold text-red-700 hover:bg-red-50">
          <span>▶</span> YouTube’da shu mavzudagi videolarni ko‘rish
        </a>
      )}
    </article>
  );
}
