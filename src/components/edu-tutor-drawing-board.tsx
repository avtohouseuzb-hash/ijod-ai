"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type TutorDrawing = {
  title: string;
  subtitle: string;
  strokes: Array<{ label: string; d: string }>;
};

function getPoint(event: ReactPointerEvent<SVGSVGElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

export default function EduTutorDrawingBoard({ drawing }: { drawing: TutorDrawing }) {
  const practiceRef = useRef<SVGSVGElement | null>(null);
  const drawingNow = useRef(false);
  const [practiceStrokes, setPracticeStrokes] = useState<string[]>([]);
  const [activeStroke, setActiveStroke] = useState("");

  function startPractice(event: ReactPointerEvent<SVGSVGElement>) {
    if (!practiceRef.current) return;
    event.preventDefault();
    practiceRef.current.setPointerCapture(event.pointerId);
    drawingNow.current = true;
    const point = getPoint(event);
    setActiveStroke(`M ${point.x} ${point.y}`);
  }

  function movePractice(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drawingNow.current) return;
    event.preventDefault();
    const point = getPoint(event);
    setActiveStroke((current) => current ? `${current} L ${point.x} ${point.y}` : `M ${point.x} ${point.y}`);
  }

  function finishPractice() {
    if (!drawingNow.current) return;
    drawingNow.current = false;
    const completedStroke = activeStroke;
    setActiveStroke("");
    if (completedStroke.trim()) {
      setPracticeStrokes((strokes) => [...strokes, completedStroke]);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-violet-200 bg-white">
      <style>{`@keyframes ijod-tutor-draw { to { stroke-dashoffset: 0; } }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 px-4 py-3">
        <div>
          <p className="text-sm font-extrabold text-slate-800">{drawing.title}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{drawing.subtitle}</p>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-bold text-violet-700">USTOZ CHIZIB KO‘RSATADI</span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(190px,.8fr)]">
        <div className="rounded-xl border border-slate-100 bg-[#fffefb] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Harfning yozilish tartibi</p>
          <svg viewBox="0 0 100 100" role="img" aria-label={drawing.title + " yozilishini chizib ko‘rsatish"} className="block w-full touch-none">
            <defs>
              <marker id="tutor-stroke-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0 0 L5 2.5 L0 5" fill="#7c3aed" />
              </marker>
            </defs>
            <path d="M 8 24 H 92 M 8 78 H 92" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="2 2" />
            <path d="M 8 50 H 92" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="1 3" />
            {drawing.strokes.map((stroke, index) => {
              const start = stroke.d.match(/^\s*[Mm]\s*([\d.-]+)[,\s]+([\d.-]+)/);
              const sx = start ? Number(start[1]) : 10;
              const sy = start ? Number(start[2]) : 10;
              return (
                <g key={index}>
                  <path d={stroke.d} fill="none" stroke="#7c3aed" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100} markerEnd="url(#tutor-stroke-arrow)" style={{ animation: "ijod-tutor-draw 1.25s ease-out forwards", animationDelay: `${index * 1.15}s` }} />
                  <circle cx={sx} cy={sy} r="4" fill="#f59e0b" stroke="white" strokeWidth="1.2" />
                  <text x={sx + 5} y={sy - 4} fill="#92400e" fontSize="6" fontWeight="bold">{index + 1}</text>
                </g>
              );
            })}
          </svg>
          <p className="mt-2 text-center text-[10px] text-slate-400">1 → 2 → tartibida chiziqlarni kuzat.</p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qadamlar</p>
          {drawing.strokes.map((stroke, index) => (
            <div key={index} className="flex gap-2 rounded-xl bg-violet-50/80 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-black text-white">{index + 1}</span>
              <p className="pt-0.5 text-xs leading-5 text-slate-700">{stroke.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/70 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold text-slate-800">Endi o‘zing chizib ko‘r</p>
            <p className="mt-1 text-[10px] text-slate-500">Barmoq yoki sichqoncha bilan yoz. Xohlasang, qayta boshlashing mumkin.</p>
          </div>
          <button type="button" onClick={() => { setPracticeStrokes([]); setActiveStroke(""); drawingNow.current = false; }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:border-violet-300 hover:text-violet-700">Tozalash</button>
        </div>
        <svg
          ref={practiceRef}
          viewBox="0 0 100 100"
          role="img"
          aria-label="Harfni mustaqil yozish maydoni"
          className="block h-40 w-full cursor-crosshair rounded-xl border border-slate-200 bg-white touch-none"
          onPointerDown={startPractice}
          onPointerMove={movePractice}
          onPointerUp={finishPractice}
          onPointerCancel={finishPractice}
          onLostPointerCapture={finishPractice}
        >
          <path d="M 5 24 H 95 M 5 78 H 95" stroke="#cbd5e1" strokeWidth="0.7" strokeDasharray="2 2" />
          {drawing.strokes.map((stroke, index) => <path key={index} d={stroke.d} fill="none" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="2 2" strokeLinecap="round" strokeLinejoin="round" />)}
          {practiceStrokes.map((stroke, index) => <path key={index} d={stroke} fill="none" stroke="#6d28d9" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />)}
          {activeStroke && <path d={activeStroke} fill="none" stroke="#6d28d9" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </div>
    </div>
  );
}
