"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { EduLiveBoardPayload, EduWhiteboardCommand, WhiteboardColor } from "@/lib/edu-live/types";

type StudentStroke = { id: string; path: string; color: string; width: number };
type Point = { x: number; y: number };
type Tool = "pen" | "eraser";

const WIDTH = 1000;
const HEIGHT = 700;
const PALETTE = ["#172033", "#2563eb", "#dc2626", "#059669", "#7c3aed", "#d97706"];

function pathFromPoints(points: Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} l 0.1 0.1`;
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function commandTitle(commands: EduWhiteboardCommand[]) {
  return [...commands].reverse().find((command) => command.type === "title") as Extract<EduWhiteboardCommand, { type: "title" }> | undefined;
}

function isVisibleCommand(command: EduWhiteboardCommand) {
  return ["title", "text", "shape", "path", "formula"].includes(command.type);
}

function SvgCommand({ command, highlighted }: { command: EduWhiteboardCommand; highlighted: boolean }) {
  const glow = highlighted ? "#f59e0b" : undefined;
  const highlightProps = highlighted ? { filter: "url(#edu-live-highlight)" } : {};

  switch (command.type) {
    case "text":
      return <text x={command.x} y={command.y} fontSize={command.fontSize ?? 26} fontWeight="500" fill={glow ?? command.color ?? "#263247"} {...highlightProps}>{command.text}</text>;
    case "formula":
      return <text x={command.x} y={command.y} fontSize="30" fontWeight="700" fill={glow ?? command.color ?? "#172554"} {...highlightProps}>{command.expression}</text>;
    case "path":
      return <path d={command.d} fill={command.fill ?? "none"} stroke={glow ?? command.stroke} strokeWidth={command.strokeWidth ?? 4} strokeLinecap="round" strokeLinejoin="round" {...highlightProps}/>;
    case "shape": {
      const common = { fill: command.fill === "none" || !command.fill ? "none" : command.fill, stroke: glow ?? command.stroke, strokeWidth: command.strokeWidth ?? 4, ...highlightProps };
      if (command.shape === "circle") return <ellipse cx={command.x + command.width / 2} cy={command.y + command.height / 2} rx={command.width / 2} ry={command.height / 2} {...common}/>;
      if (command.shape === "ellipse") return <ellipse cx={command.x + command.width / 2} cy={command.y + command.height / 2} rx={command.width / 2} ry={command.height / 2} {...common}/>;
      if (command.shape === "line") return <line x1={command.x} y1={command.y} x2={command.x + command.width} y2={command.y + command.height} {...common}/>;
      if (command.shape === "arrow") return <line x1={command.x} y1={command.y} x2={command.x + command.width} y2={command.y + command.height} markerEnd="url(#edu-live-arrow)" {...common}/>;
      if (command.shape === "triangle") return <polygon points={`${command.x + command.width / 2},${command.y} ${command.x + command.width},${command.y + command.height} ${command.x},${command.y + command.height}`} {...common}/>;
      return <rect x={command.x} y={command.y} width={command.width} height={command.height} rx="8" {...common}/>;
    }
    default:
      return null;
  }
}

export default function EduLiveWhiteboard({
  payload,
  className = "",
}: {
  payload?: EduLiveBoardPayload | null;
  className?: string;
}) {
  const commands = payload?.commands ?? [];
  const [revealedCount, setRevealedCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PALETTE[0]);
  const [studentStrokes, setStudentStrokes] = useState<StudentStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StudentStroke | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const strokeIdRef = useRef(0);

  useEffect(() => {
    setRevealedCount(0);
    setPlaying(false);
    setStudentStrokes([]);
    setCurrentStroke(null);
    setActiveStep(0);
  }, [payload]);

  useEffect(() => {
    if (!playing || revealedCount >= commands.length) {
      if (revealedCount >= commands.length) setPlaying(false);
      return;
    }
    const command = commands[revealedCount];
    const delay = command.delayMs ?? (revealedCount === 0 ? 0 : 500);
    const timer = window.setTimeout(() => {
      setRevealedCount((value) => Math.min(value + 1, commands.length));
      if (command.type === "reveal_step") setActiveStep((value) => value + 1);
      if (command.type === "finish") setPlaying(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [playing, revealedCount, commands]);

  const visibleCommands = useMemo(() => {
    const visible: EduWhiteboardCommand[] = [];
    for (const command of commands.slice(0, revealedCount)) {
      if (command.type === "clear") visible.length = 0;
      else if (isVisibleCommand(command)) visible.push(command);
    }
    return visible;
  }, [commands, revealedCount]);

  const highlightedIds = useMemo(() => new Set(
    commands.slice(0, revealedCount)
      .filter((command): command is Extract<EduWhiteboardCommand, { type: "highlight" }> => command.type === "highlight")
      .map((command) => command.targetId)
  ), [commands, revealedCount]);

  const title = commandTitle(visibleCommands);
  const hasCommands = commands.length > 0;
  const progress = commands.length ? Math.round((revealedCount / commands.length) * 100) : 0;

  function eventPoint(event: ReactPointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(WIDTH, ((event.clientX - rect.left) / rect.width) * WIDTH)),
      y: Math.max(0, Math.min(HEIGHT, ((event.clientY - rect.top) / rect.height) * HEIGHT)),
    };
  }

  function startDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drawingMode) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = eventPoint(event);
    pointsRef.current = [point];
    strokeIdRef.current += 1;
    setCurrentStroke({
      id: `student-${strokeIdRef.current}`,
      path: pathFromPoints(pointsRef.current),
      color: tool === "eraser" ? "#ffffff" : color,
      width: tool === "eraser" ? 24 : 5,
    });
  }

  function moveDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drawingMode || !currentStroke) return;
    event.preventDefault();
    pointsRef.current = [...pointsRef.current, eventPoint(event)];
    setCurrentStroke({ ...currentStroke, path: pathFromPoints(pointsRef.current) });
  }

  function finishDrawing() {
    if (currentStroke && currentStroke.path) setStudentStrokes((items) => [...items, currentStroke]);
    setCurrentStroke(null);
    pointsRef.current = [];
  }

  function play() {
    if (revealedCount >= commands.length) setRevealedCount(0);
    setPlaying(true);
  }

  function reset() {
    setPlaying(false);
    setRevealedCount(0);
    setActiveStep(0);
  }

  function nextStep() {
    setPlaying(false);
    setRevealedCount((value) => Math.min(value + 1, commands.length));
  }

  return (
    <section className={`w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`} aria-label="Jonli interaktiv doska">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold text-slate-800">{title?.text ?? "Interaktiv doska"}</p>
          <p className="text-[10px] text-slate-400">{hasCommands ? `${revealedCount}/${commands.length} bosqich · ${progress}%` : "Ustoz chizmasi kutilmoqda"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={reset} disabled={!revealedCount} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Qayta</button>
          <button type="button" onClick={nextStep} disabled={!hasCommands || revealedCount >= commands.length} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Keyingi</button>
          <button type="button" onClick={() => playing ? setPlaying(false) : play()} disabled={!hasCommands} className="rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-violet-700 disabled:opacity-40">{playing ? "Pauza" : revealedCount >= commands.length ? "Qayta ijro" : "Ijro etish"}</button>
        </div>
      </div>

      <div className="relative min-w-0 bg-[#fffefb]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="AI ustoz va o‘quvchi chizmalari"
          className={`block aspect-[10/7] w-full touch-none ${drawingMode ? "cursor-crosshair" : ""}`}
          onPointerDown={startDrawing}
          onPointerMove={moveDrawing}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          onLostPointerCapture={finishDrawing}
        >
          <defs>
            <pattern id="edu-live-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#f1f0eb" strokeWidth="1.2"/>
            </pattern>
            <filter id="edu-live-highlight" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <marker id="edu-live-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M0 0 L10 5 L0 10 Z" fill="#475569"/>
            </marker>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#edu-live-grid)"/>
          {visibleCommands.map((command) => (
            <g key={command.id}>
              <SvgCommand command={command} highlighted={highlightedIds.has(command.id)}/>
            </g>
          ))}
          {studentStrokes.map((stroke) => <path key={stroke.id} d={stroke.path} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round}/>)}
          {currentStroke && <path d={currentStroke.path} fill="none" stroke={currentStroke.color} strokeWidth={currentStroke.width} strokeLinecap="round" strokeLinejoin="round}/>}
        </svg>
        {!hasCommands && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="max-w-xs text-xs leading-5 text-slate-400">Dars boshlanganda AI ustoz chizmani shu yerda bosqichma-bosqich yaratadi.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDrawingMode((value) => !value)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${drawingMode ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-violet-50"}`}>{drawingMode ? "Chizish yoqilgan" : "O‘zing chiz"}</button>
          <button type="button" onClick={() => setStudentStrokes((items) => items.slice(0, -1))} disabled={!studentStrokes.length} className="rounded-lg px-2.5 py-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40">Bekor qilish</button>
        </div>
        {drawingMode && (
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Ruchka" onClick={() => setTool("pen")} className={`rounded-md px-2 py-1 text-[10px] font-bold ${tool === "pen" ? "bg-violet-100 text-violet-700" : "text-slate-500"}`}>✎</button>
            <button type="button" aria-label="O‘chirg‘ich" onClick={() => setTool("eraser")} className={`rounded-md px-2 py-1 text-[10px] font-bold ${tool === "eraser" ? "bg-violet-100 text-violet-700" : "text-slate-500"}`}>⌫</button>
            {PALETTE.map((swatch) => <button key={swatch} type="button" aria-label={`Rang ${swatch}`} onClick={() => { setTool("pen"); setColor(swatch); }} className="h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200" style={{ backgroundColor: swatch }} />)}
          </div>
        )}
      </div>
    </section>
  );
}
