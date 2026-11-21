"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import type {EduLiveWhiteboardCommand,EduLiveWhiteboardPayload} from "@/lib/edu-live/types";
type Point={x:number;y:number};type Stroke={id:number;path:string};
function getTextClass(color?: string) {
  if (color?.toLowerCase() === "#6d28d9") return "edu-live-handwritten edu-live-accent-text";
  if (color?.toLowerCase() === "#047857") return "edu-live-handwritten edu-live-success-text";
  return "edu-live-handwritten edu-live-body-text";
}

function getWriteDurationMs(command: EduLiveWhiteboardCommand): number {
  if (command.type === "title") return Math.min(2100, 650 + command.text.length * 25);
  if (command.type === "text") return Math.min(2400, 450 + command.text.length * 18);
  if (command.type === "formula") return Math.min(1800, 600 + command.expression.length * 35);
  return 0;
}

function DrawCommand({ command }: { command: EduLiveWhiteboardCommand }) {
  switch (command.type) {
    case "title":
      return (
        <text
          className={getTextClass(command.color) + " edu-live-title-text"}
          x="50" y="72" fontSize="36" fontWeight="700"
          fill={command.color ?? "#6d28d9"} stroke={command.color ?? "#6d28d9"}
          strokeWidth="0.28" strokeLinecap="round"
          style={{ "--write-duration": `${getWriteDurationMs(command)}ms` } as React.CSSProperties}
        >{command.text}</text>
      );
    case "text":
      return (
        <text
          className={getTextClass(command.color)}
          x={command.x} y={command.y} fontSize={command.fontSize ?? 22}
          fill={command.color ?? "#243047"} stroke={command.color ?? "#243047"}
          strokeWidth="0.18" strokeLinecap="round"
          style={{ "--write-duration": `${getWriteDurationMs(command)}ms` } as React.CSSProperties}
        >{command.text}</text>
      );
    case "formula":
      return (
        <text
          className={getTextClass(command.color) + " edu-live-formula-text"}
          x={command.x} y={command.y} fontSize="25" fontWeight="600"
          fill={command.color ?? "#6d28d9"} stroke={command.color ?? "#6d28d9"}
          strokeWidth="0.2" strokeLinecap="round"
          style={{ "--write-duration": `${getWriteDurationMs(command)}ms` } as React.CSSProperties}
        >{command.expression}</text>
      );
    case "rect":
      return (
        <rect
          className={command.fill?.toLowerCase() === "#f0f9ff" ? "edu-live-node-shape" : "edu-live-step-shape"}
          x={command.x} y={command.y} width={command.width} height={command.height}
          rx="9" stroke={command.stroke} strokeWidth="2" fill={command.fill ?? "none"}
        />
      );
    case "arrow":
      return <line className="edu-live-arrow-line" x1={command.x} y1={command.y} x2={command.x + command.width} y2={command.y + command.height} stroke={command.stroke} strokeWidth="3" markerEnd="url(#edu-live-arrow)" />;
    default:
      return null;
  }
}

export default function EduLiveWhiteboard({payload}:{payload:EduLiveWhiteboardPayload}){
const[revealed,setRevealed]=useState(0),[playing,setPlaying]=useState(true),[drawing,setDrawing]=useState(false),[strokes,setStrokes]=useState<Stroke[]>([]),[activePath,setActivePath]=useState("");const points=useRef<Point[]>([]),nextId=useRef(0);
useEffect(()=>{setRevealed(0);setPlaying(true);setStrokes([]);setActivePath("");points.current=[];},[payload]);
useEffect(() => {
  if (!playing || revealed >= payload.commands.length) {
    if (revealed >= payload.commands.length) setPlaying(false);
    return;
  }
  const command = payload.commands[revealed];
  // Each text row must finish writing before the next row/shape is revealed.
  const writeDuration = getWriteDurationMs(command);
  const waitMs = Math.max(command.delayMs ?? 400, writeDuration + (writeDuration > 0 ? 220 : 0));
  const timer = window.setTimeout(() => {
    setRevealed((value) => Math.min(value + 1, payload.commands.length));
  }, waitMs);
  return () => window.clearTimeout(timer);
}, [payload, playing, revealed]);
const visible=useMemo(()=>{const out:EduLiveWhiteboardCommand[]=[];for(const c of payload.commands.slice(0,revealed)){if(c.type==="clear")out.length=0;else if(["title","text","formula","rect","arrow"].includes(c.type))out.push(c);}return out;},[payload,revealed]);
const progress=payload.commands.length?Math.round(revealed/payload.commands.length*100):0;const title=[...visible].reverse().find(c=>c.type==="title");
function getPoint(e:ReactPointerEvent<SVGSVGElement>){const r=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000)),y:Math.max(0,Math.min(760,(e.clientY-r.top)/r.height*760))};}
function start(e:ReactPointerEvent<SVGSVGElement>){if(!drawing)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const p=getPoint(e);points.current=[p];setActivePath(`M ${p.x} ${p.y}`);}
function move(e:ReactPointerEvent<SVGSVGElement>){if(!drawing||!points.current.length)return;e.preventDefault();points.current=[...points.current,getPoint(e)];setActivePath(points.current.map((p,i)=>`${i===0?"M":"L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "));}
function finish(){if(activePath){nextId.current++;setStrokes(v=>[...v,{id:nextId.current,path:activePath}]);}points.current=[];setActivePath("");}
function replay(){setRevealed(0);setPlaying(true);}
return <section className="edu-live-whiteboard mt-3 min-w-0 overflow-hidden rounded-2xl border border-violet-200 bg-white" aria-label="Jonli interaktiv doska">
<div className="edu-live-whiteboard-toolbar flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/70 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-800">{title?.type==="title"?title.text:"Interaktiv doska"}</p><p className="edu-live-whiteboard-subtitle text-[10px] text-slate-500">Ustoz chizmoqda · {progress}%</p></div><div className="flex items-center gap-1.5"><button type="button" onClick={replay} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-600 hover:bg-white">Qayta</button><button type="button" onClick={()=>setRevealed(v=>Math.min(v+1,payload.commands.length))} disabled={revealed>=payload.commands.length} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-600 disabled:opacity-40">Keyingi</button><button type="button" onClick={()=>setPlaying(v=>!v)} className="rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-bold text-white">{playing?"Pauza":"Davom etish"}</button></div></div>
<style>{`
@keyframes edu-live-write-in {
  0% { clip-path: inset(0 100% 0 0); opacity: .55; }
  100% { clip-path: inset(0 0 0 0); opacity: 1; }
}
.edu-live-handwritten {
  font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive;
  letter-spacing: .15px;
  clip-path: inset(0 100% 0 0);
  animation: edu-live-write-in var(--write-duration, 1s) steps(28, end) both;
}
.edu-live-paused .edu-live-handwritten { animation-play-state: paused; }
html.dark .edu-live-whiteboard {
  background: #111b2d !important;
  color: #e7edf7 !important;
  border-color: #34435d !important;
}
html.dark .edu-live-whiteboard-toolbar {
  background: #19243a !important;
  border-color: #34435d !important;
}
html.dark .edu-live-whiteboard-heading { color: #f2f5fb !important; }
html.dark .edu-live-whiteboard-subtitle { color: #adbbd0 !important; }
html.dark .edu-live-whiteboard-canvas { background: #111b2d; }
html.dark .edu-live-paper-bg { fill: #111b2d !important; }
html.dark .edu-live-grid-line { stroke: #2b3a52 !important; opacity: .8; }
html.dark .edu-live-body-text { fill: #e2e8f0 !important; stroke: #e2e8f0 !important; }
html.dark .edu-live-title-text,
html.dark .edu-live-accent-text,
html.dark .edu-live-formula-text { fill: #c4b5fd !important; stroke: #c4b5fd !important; }
html.dark .edu-live-success-text { fill: #6ee7b7 !important; stroke: #6ee7b7 !important; }
html.dark .edu-live-step-shape { fill: #202c42 !important; stroke: #536583 !important; }
html.dark .edu-live-node-shape { fill: #17334c !important; stroke: #38bdf8 !important; }
html.dark .edu-live-arrow-line { stroke: #a78bfa !important; }
html.dark #edu-live-arrow path { fill: #a78bfa !important; }
html.dark .edu-live-whiteboard-footer { border-color: #34435d !important; }
html.dark .edu-live-whiteboard-footer button { color: #d7e1ef !important; }
html.dark .edu-live-whiteboard-footer button:first-child { background: #263451 !important; }
@media (prefers-reduced-motion: reduce) {
  .edu-live-handwritten { animation: none; clip-path: none; }
}
`}</style>
<svg className={`edu-live-whiteboard-canvas ${!playing ? "edu-live-paused" : ""}`} viewBox="0 0 1000 760" role="img" aria-label="AI Ustoz chizayotgan mavzu" className={`block aspect-[5/4] w-full touch-none ${drawing?"cursor-crosshair":""}`} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}><defs><pattern id="edu-live-paper" width="48" height="48" patternUnits="userSpaceOnUse"><path className="edu-live-grid-line" d="M48 0H0V48" fill="none" stroke="#f0eee8" strokeWidth="1.2"/></pattern><marker id="edu-live-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#7c3aed"/></marker></defs><rect className="edu-live-paper-bg" width="1000" height="760" fill="url(#edu-live-paper)"/>{visible.map(c=><DrawCommand key={c.id} command={c}/>)}{strokes.map(s=><path key={s.id} d={s.path} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>)}{activePath&&<path d={activePath} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>}</svg>
<div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5"><button type="button" onClick={()=>setDrawing(v=>!v)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${drawing?"bg-violet-600 text-white":"bg-slate-100 text-slate-700"}`}>{drawing?"Chizish yoqilgan":"O‘zing chiz"}</button><button type="button" onClick={()=>setStrokes(v=>v.slice(0,-1))} disabled={!strokes.length} className="rounded-lg px-2.5 py-2 text-[10px] text-slate-500 disabled:opacity-40">Bekor qilish</button></div></section>;
}
