"use client";

import type { ChemistryVisual } from "@/components/edu-tutor-chemistry-visual";
import EduTutorChemistryVisual from "@/components/edu-tutor-chemistry-visual";

export type EduTutorBoardPlan = {
  title: string;
  explanation: string;
  steps: string[];
  formula: string;
  example: string;
  summary: string;
  checkQuestion: string;
  diagram: {
    kind: "none" | "flow" | "timeline" | "comparison" | "concept_map";
    title: string;
    nodes: string[];
    relationships: string[];
    caption: string;
  };
};

function LessonDiagram({ diagram }: { diagram: EduTutorBoardPlan["diagram"] }) {
  if (!diagram || diagram.kind === "none" || diagram.nodes.length === 0) return null;
  const nodes = diagram.nodes.slice(0, 6);
  const relationships = diagram.relationships.slice(0, 6);
  const isSequence = diagram.kind === "flow" || diagram.kind === "timeline";

  return (
    <section className="min-w-0 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/80 to-violet-50/70 p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-cyan-700">KO‘RGAZMALI SXEMA</p>
      <h4 className="mt-1 text-sm font-extrabold text-slate-800">{diagram.title || "Mavzu sxemasi"}</h4>
      <div className={isSequence ? "mt-4 flex flex-wrap items-center gap-2" : "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"}>
        {nodes.map((node, index) => (
          <div key={index} className="flex min-w-0 items-center gap-2">
            <div className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white bg-white px-3 py-2 text-center text-[11px] font-bold leading-5 text-slate-800 shadow-sm">{node}</div>
            {isSequence && index < nodes.length - 1 && <span aria-hidden="true" className="text-lg font-black text-violet-500">→</span>}
          </div>
        ))}
      </div>
      {relationships.length > 0 && <ul className="mt-3 space-y-1.5">{relationships.map((relationship, index) => <li key={index} className="flex gap-2 text-[10px] leading-5 text-slate-600"><span className="font-black text-violet-500">•</span><span>{relationship}</span></li>)}</ul>}
      {diagram.caption && <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-[10px] leading-5 text-slate-600">{diagram.caption}</p>}
    </section>
  );
}

export default function EduTutorLessonBoard({ board, visual }: { board: EduTutorBoardPlan; visual?: ChemistryVisual | null }) {
  return (
    <div className="w-full min-w-0 max-w-full space-y-3">
      <header className="min-w-0 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-cyan-50 p-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-violet-600">BUGUNGI DARS</p>
        <h3 className="mt-1 text-base font-black text-slate-900">{board.title}</h3>
        <p className="mt-2 text-xs leading-6 text-slate-700">{board.explanation}</p>
      </header>

      {board.steps.length > 0 && <section className="rounded-2xl border border-slate-100 bg-white p-4">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">BOSQICHMA-BOSQICH</h4>
        <ol className="mt-3 space-y-3">{board.steps.slice(0, 6).map((step, index) => <li key={index} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-black text-white">{index + 1}</span><p className="pt-0.5 text-xs leading-6 text-slate-700">{step}</p></li>)}</ol>
      </section>}

      {board.formula && <section className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4"><h4 className="text-[9px] font-black uppercase tracking-widest text-cyan-800">FORMULA / QOIDA</h4><p className="mt-2 whitespace-pre-wrap break-words text-center text-base font-black leading-8 text-slate-900">{board.formula}</p></section>}
      {board.example && <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4"><h4 className="text-[9px] font-black uppercase tracking-widest text-amber-800">MISOL</h4><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-700">{board.example}</p></section>}
      <LessonDiagram diagram={board.diagram} />
      {visual && <EduTutorChemistryVisual visual={visual} />}
      {board.summary && <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-800">ESLAB QOL</h4><p className="mt-2 text-xs font-semibold leading-6 text-slate-800">{board.summary}</p></section>}
      {board.checkQuestion && <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4"><h4 className="text-[9px] font-black uppercase tracking-widest text-violet-700">O‘ZINGNI TEKSHIR</h4><p className="mt-2 text-xs font-semibold leading-6 text-slate-800">{board.checkQuestion}</p></section>}
    </div>
  );
}
