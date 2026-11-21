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
    <div className="min-w-0 border-l-2 border-cyan-300 py-1 pl-3">
      <p className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-700">Ko‘rgazmali sxema · {diagram.title || "Mavzu sxemasi"}</p>
      <div className={isSequence ? "mt-2 flex min-w-0 flex-wrap items-center gap-1.5" : "mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3"}>
        {nodes.map((node, index) => (
          <div key={index} className="flex min-w-0 items-center gap-1.5">
            <div className="flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-lg bg-white/80 px-2 py-1.5 text-center text-[10px] font-bold leading-4 text-slate-800">{node}</div>
            {isSequence && index < nodes.length - 1 && <span aria-hidden="true" className="shrink-0 text-sm font-black text-violet-500">→</span>}
          </div>
        ))}
      </div>
      {relationships.length > 0 && <ul className="mt-2 space-y-1">{relationships.map((relationship, index) => <li key={index} className="flex gap-1.5 text-[10px] leading-4 text-slate-600"><span className="font-black text-violet-500">•</span><span>{relationship}</span></li>)}</ul>}
      {diagram.caption && <p className="mt-2 text-[10px] leading-4 text-slate-600">{diagram.caption}</p>}
    </div>
  );
}

export default function EduTutorLessonBoard({ board, visual }: { board: EduTutorBoardPlan; visual?: ChemistryVisual | null }) {
  return (
    <div className="mt-3 w-full min-w-0 max-w-full space-y-3 border-t border-violet-200/80 pt-3">
      <section className="min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-violet-600">Mavzu</p>
        <h3 className="mt-0.5 text-sm font-extrabold leading-5 text-slate-900">{board.title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-700">{board.explanation}</p>
      </section>

      {board.steps.length > 0 && <section className="min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-violet-600">Bosqichma-bosqich</p>
        <ol className="mt-2 space-y-2">
          {board.steps.slice(0, 6).map((step, index) => (
            <li key={index} className="flex min-w-0 gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[9px] font-black text-violet-700">{index + 1}</span>
              <p className="min-w-0 flex-1 text-xs leading-5 text-slate-700">{step}</p>
            </li>
          ))}
        </ol>
      </section>}

      {board.formula && <section className="min-w-0 rounded-xl bg-white/75 px-3 py-2">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-700">Formula / qoida</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-slate-900">{board.formula}</p>
      </section>}

      {board.example && <section className="min-w-0">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700">Misol</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{board.example}</p>
      </section>}

      {board.diagram && <LessonDiagram diagram={board.diagram} />}
      {visual && <EduTutorChemistryVisual visual={visual} />}

      {board.summary && <section className="min-w-0 border-l-2 border-emerald-400 pl-3">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">Esda qol</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-800">{board.summary}</p>
      </section>}

      {board.checkQuestion && <section className="min-w-0 border-l-2 border-violet-400 pl-3">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-violet-700">O‘zingni tekshir</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-800">{board.checkQuestion}</p>
      </section>}
    </div>
  );
}
