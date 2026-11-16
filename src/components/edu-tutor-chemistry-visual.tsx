"use client";

export type ChemistryVisual =
  | { kind: "atom"; title: string; subtitle: string }
  | { kind: "molecule"; title: string; formula: string; subtitle: string; atoms: string[] }
  | { kind: "reaction"; title: string; equation: string; subtitle: string }
  | { kind: "summary"; title: string; points: string[] };

export default function EduTutorChemistryVisual({ visual }: { visual: ChemistryVisual }) {
  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-cyan-50 bg-gradient-to-r from-cyan-50 to-violet-50 px-4 py-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-700">KO‘RGAZMALI KIMYO</p>
          <h3 className="mt-1 text-sm font-extrabold text-slate-800">{visual.title}</h3>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1 text-[9px] font-bold text-cyan-700">SXEMA</span>
      </div>

      {visual.kind === "atom" && (
        <div className="grid gap-4 p-4 md:grid-cols-[1.1fr_.9fr] md:items-center">
          <div className="rounded-xl bg-[#f8fbff] p-2">
            <svg viewBox="0 0 320 220" role="img" aria-label="Proton, neytron va elektronlarning atomdagi joylashuvi" className="mx-auto block w-full max-w-[420px]">
              <ellipse cx="160" cy="110" rx="122" ry="58" fill="none" stroke="#9cc8f5" strokeWidth="2.5" transform="rotate(-25 160 110)" />
              <ellipse cx="160" cy="110" rx="122" ry="58" fill="none" stroke="#9cc8f5" strokeWidth="2.5" transform="rotate(25 160 110)" />
              <ellipse cx="160" cy="110" rx="122" ry="58" fill="none" stroke="#c4b5fd" strokeWidth="1.5" />
              <circle cx="160" cy="110" r="31" fill="#fff1e8" stroke="#fdba74" strokeWidth="1.5" />
              <circle cx="149" cy="101" r="10" fill="#f97316" /><text x="149" y="105" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">p+</text>
              <circle cx="169" cy="101" r="10" fill="#64748b" /><text x="169" y="105" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">n⁰</text>
              <circle cx="151" cy="120" r="10" fill="#f97316" /><text x="151" y="124" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">p+</text>
              <circle cx="170" cy="120" r="10" fill="#64748b" /><text x="170" y="124" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">n⁰</text>
              <circle cx="38" cy="110" r="8" fill="#2563eb" stroke="white" strokeWidth="2" /><text x="38" y="113" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">e−</text>
              <circle cx="258" cy="110" r="8" fill="#2563eb" stroke="white" strokeWidth="2" /><text x="258" y="113" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">e−</text>
              <circle cx="91" cy="62" r="8" fill="#2563eb" stroke="white" strokeWidth="2" /><text x="91" y="65" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">e−</text>
              <circle cx="229" cy="158" r="8" fill="#2563eb" stroke="white" strokeWidth="2" /><text x="229" y="161" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">e−</text>
              <text x="160" y="207" textAnchor="middle" fill="#64748b" fontSize="10">Atomning soddalashtirilgan modeli</text>
            </svg>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl bg-orange-50 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">p+</span>
              <div><p className="text-xs font-extrabold text-slate-800">Proton</p><p className="text-[10px] leading-4 text-slate-600">Yadro ichida · musbat zaryad (+)</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-500 text-xs font-black text-white">n⁰</span>
              <div><p className="text-xs font-extrabold text-slate-800">Neytron</p><p className="text-[10px] leading-4 text-slate-600">Yadro ichida · zaryadsiz (0)</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">e−</span>
              <div><p className="text-xs font-extrabold text-slate-800">Elektron</p><p className="text-[10px] leading-4 text-slate-600">Yadro atrofida · manfiy zaryad (−)</p></div>
            </div>
          </div>
          <p className="md:col-span-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-800">{visual.subtitle}</p>
        </div>
      )}

      {visual.kind === "molecule" && (
        <div className="p-4">
          <p className="text-center text-3xl font-black tracking-widest text-violet-700">{visual.formula}</p>
          <div className="my-4 flex flex-wrap items-center justify-center gap-2">
            {visual.atoms.map((atom, index) => (
              <div key={index} className="flex items-center gap-2">
                {index > 0 && <span className="h-1 w-8 rounded-full bg-slate-300" />}
                <span className={"flex h-14 w-14 items-center justify-center rounded-full border-4 text-sm font-black shadow-sm " + (atom === "O" ? "border-rose-200 bg-rose-50 text-rose-700" : atom === "H" ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-violet-200 bg-violet-50 text-violet-700")}>{atom}</span>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-slate-50 p-3 text-center text-xs leading-5 text-slate-600">{visual.subtitle}</p>
        </div>
      )}

      {visual.kind === "reaction" && (
        <div className="p-4">
          <div className="rounded-xl bg-violet-50 p-4 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-violet-500">REAKSIYA TENGLAMASI</p>
            <p className="mt-2 break-words text-xl font-black text-violet-800">{visual.equation}</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-600">{visual.subtitle}</p>
        </div>
      )}

      {visual.kind === "summary" && (
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {visual.points.map((point, index) => (
            <div key={index} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-black text-cyan-800">{index + 1}</span>
              <p className="text-xs leading-5 text-slate-700">{point}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
