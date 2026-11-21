"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EduTutorBoardPlan } from "@/components/edu-tutor-lesson-board";
import type { ChemistryVisual } from "@/components/edu-tutor-chemistry-visual";
import type { TutorDrawing } from "@/components/edu-tutor-drawing-board";
import EduLiveWhiteboard from "@/components/edu-live-whiteboard";
import type { EduLiveWhiteboardPayload } from "@/lib/edu-live/types";

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
  videoNotice?: string;
  board?: EduTutorBoardPlan;
  whiteboard?: EduLiveWhiteboardPayload;
  visual?: ChemistryVisual;
  drawing?: TutorDrawing;
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
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(nextUrl);
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
      {message.whiteboard && <EduLiveWhiteboard payload={message.whiteboard} />}
      {!message.whiteboard && message.board && <EduTutorLessonBoard board={message.board} visual={message.visual} />}
      {audioUrl && <audio controls autoPlay src={audioUrl} className="mt-3 h-9 w-full" />}
      {audioError && <p role="alert" className="mt-2 text-[10px] text-rose-600">{audioError}</p>}
      {message.videos && message.videos.length > 0 && (() => {
        const video = message.videos[0];
        return (
          <div className="mt-4 overflow-hidden rounded-xl border border-red-100 bg-white">
            <div className="flex items-center gap-2 px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-700"><span className="text-red-600">▶</span> Ustoz tanlagan bitta video</div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={"https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.id) + "?rel=0"}
                title={video.title}
                className="h-full w-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div className="p-3">
              <p className="text-[11px] font-bold leading-5 text-slate-800">{video.title}</p>
              <p className="mt-1 text-[10px] text-slate-400">{video.channelTitle}</p>
              <a href={video.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] font-semibold text-red-700 hover:underline">YouTube’da ochish ↗</a>
            </div>
          </div>
        );
      })()}
      {message.videoNotice && <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2.5 text-[10px] leading-5 text-slate-500">{message.videoNotice}</p>}
    </article>
  );
}
