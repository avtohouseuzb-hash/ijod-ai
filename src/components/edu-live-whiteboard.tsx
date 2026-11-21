"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import type {EduLiveWhiteboardCommand,EduLiveWhiteboardPayload} from "@/lib/edu-live/types";
type Point={x:number;y:number};type Stroke={id:number;path:string};
function writtenTextClass() { return "edu-live-handwritten"; }
function DrawCommand({command}:{command:EduLiveWhiteboardCommand}){switch(command.type){
case"title":return <text className={writtenTextClass()} x="50" y="72" fontSize="36" fontWeight="700" fill={command.color??"#6d28d9"} stroke={command.color??"#6d28d9"} strokeWidth="0.28" strokeLinecap="round" style={{"--write-duration": `${Math.min(2.1,0.65+command.text.length*0.025)}s`} as React.CSSProperties}>{command.text}</text>;
case"text":return <text className={writtenTextClass()} x={command.x} y={command.y} fontSize={command.fontSize??22} fill={command.color??"#243047"} stroke={command.color??"#243047"} strokeWidth="0.18" strokeLinecap="round" style={{"--write-duration": `${Math.min(2.4,0.45+command.text.length*0.018)}s`} as React.CSSProperties}>{command.text}</text>;
case"formula":return <text className={writtenTextClass()} x={command.x} y={command.y} fontSize="25" fontWeight="600" fill={command.color??"#6d28d9"} stroke={command.color??"#6d28d9"} strokeWidth="0.2" strokeLinecap="round" style={{"--write-duration": `${Math.min(1.8,0.6+command.expression.length*0.035)}s`} as React.CSSProperties}>{command.expression}</text>;
case"rect":return <rect x={command.x} y={command.y} width={command.width} height={command.height} rx="9" stroke={command.stroke} strokeWidth="2" fill={command.fill??"none"}/>;
case"arrow":return <line x1={command.x} y1={command.y} x2={command.x+command.width} y2={command.y+command.height} stroke={command.stroke} strokeWidth="3" markerEnd="url(#edu-live-arrow)"/>;default:return null;}}
export default function EduLiveWhiteboard({payload}:{payload:EduLiveWhiteboardPayload}){
const[revealed,setRevealed]=useState(0),[playing,setPlaying]=useState(true),[drawing,setDrawing]=useState(false),[strokes,setStrokes]=useState<Stroke[]>([]),[activePath,setActivePath]=useState("");const points=useRef<Point[]>([]),nextId=useRef(0);
useEffect(()=>{setRevealed(0);setPlaying(true);setStrokes([]);setActivePath("");points.current=[];},[payload]);
useEffect(()=>{if(!playing||revealed>=payload.commands.length){if(revealed>=payload.commands.length)setPlaying(false);return;}const c=payload.commands[revealed];const timer=window.setTimeout(()=>setRevealed(v=>Math.min(v+1,payload.commands.length)),c.delayMs??400);return()=>window.clearTimeout(timer);},[payload,playing,revealed]);
const visible=useMemo(()=>{const out:EduLiveWhiteboardCommand[]=[];for(const c of payload.commands.slice(0,revealed)){if(c.type==="clear")out.length=0;else if(["title","text","formula","rect","arrow"].includes(c.type))out.push(c);}return out;},[payload,revealed]);
const progress=payload.commands.length?Math.round(revealed/payload.commands.length*100):0;const title=[...visible].reverse().find(c=>c.type==="title");
function getPoint(e:ReactPointerEvent<SVGSVGElement>){const r=e.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000)),y:Math.max(0,Math.min(760,(e.clientY-r.top)/r.height*760))};}
function start(e:ReactPointerEvent<SVGSVGElement>){if(!drawing)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const p=getPoint(e);points.current=[p];setActivePath(`M ${p.x} ${p.y}`);}
function move(e:ReactPointerEvent<SVGSVGElement>){if(!drawing||!points.current.length)return;e.preventDefault();points.current=[...points.current,getPoint(e)];setActivePath(points.current.map((p,i)=>`${i===0?"M":"L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "));}
function finish(){if(activePath){nextId.current++;setStrokes(v=>[...v,{id:nextId.current,path:activePath}]);}points.current=[];setActivePath("");}
function replay(){setRevealed(0);setPlaying(true);}
return <section className="mt-3 min-w-0 overflow-hidden rounded-2xl border border-violet-200 bg-white" aria-label="Jonli interaktiv doska">
<div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/70 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-extrabold text-slate-800">{title?.type==="title"?title.text:"Interaktiv doska"}</p><p className="text-[10px] text-slate-500">Ustoz chizmoqda · {progress}%</p></div><div className="flex items-center gap-1.5"><button type="button" onClick={replay} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-600 hover:bg-white">Qayta</button><button type="button" onClick={()=>setRevealed(v=>Math.min(v+1,payload.commands.length))} disabled={revealed>=payload.commands.length} className="rounded-lg px-2.5 py-2 text-[10px] font-bold text-slate-600 disabled:opacity-40">Keyingi</button><button type="button" onClick={()=>setPlaying(v=>!v)} className="rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-bold text-white">{playing?"Pauza":"Davom etish"}</button></div></div>
<style>{`
@keyframes edu-live-write-in {
  0% { clip-path: inset(0 100% 0 0); opacity: .55; }
  100% { clip-path: inset(0 0 0 0); opacity: 1; }
}
.edu-live-handwritten {
  font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive;
  letter-spacing: .15px;
  clip-path: inset(0 100% 0 0);
  animation: edu-live-write-in var(--write-duration, 1s) steps(24, end) both;
}
@media (prefers-reduced-motion: reduce) {
  .edu-live-handwritten { animation: none; clip-path: none; }
}
`}</style>
<svg viewBox="0 0 1000 760" role="img" aria-label="AI Ustoz chizayotgan mavzu" className={`block aspect-[5/4] w-full touch-none ${drawing?"cursor-crosshair":""}`} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}><defs><pattern id="edu-live-paper" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#f0eee8" strokeWidth="1.2"/></pattern><marker id="edu-live-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#7c3aed"/></marker></defs><rect width="1000" height="760" fill="url(#edu-live-paper)"/>{visible.map(c=><DrawCommand key={c.id} command={c}/>)}{strokes.map(s=><path key={s.id} d={s.path} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>)}{activePath&&<path d={activePath} fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>}</svg>
<div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5"><button type="button" onClick={()=>setDrawing(v=>!v)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${drawing?"bg-violet-600 text-white":"bg-slate-100 text-slate-700"}`}>{drawing?"Chizish yoqilgan":"O‘zing chiz"}</button><button type="button" onClick={()=>setStrokes(v=>v.slice(0,-1))} disabled={!strokes.length} className="rounded-lg px-2.5 py-2 text-[10px] text-slate-500 disabled:opacity-40">Bekor qilish</button></div></section>;
}
