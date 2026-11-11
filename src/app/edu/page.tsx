"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

type Section = "home" | "tutor" | "homework" | "library" | "progress";

const subjects = [
  { name: "Matematika", short: "MAT", detail: "Algebra, geometriya va mantiq", color: "violet", icon: "calculator", progress: 72 },
  { name: "Fizika", short: "FIZ", detail: "Qonunlar, formulalar va tajribalar", color: "sky", icon: "atom", progress: 48 },
  { name: "Kimyo", short: "KIM", detail: "Elementlar va reaksiyalar", color: "emerald", icon: "flask", progress: 64 },
  { name: "Biologiya", short: "BIO", detail: "Tirik tabiat va inson organizmi", color: "lime", icon: "dna", progress: 81 },
  { name: "Ingliz tili", short: "ENG", detail: "Grammar, vocabulary va speaking", color: "amber", icon: "languages", progress: 58 },
  { name: "Tarix", short: "TAR", detail: "Davrlar, voqealar va shaxslar", color: "rose", icon: "landmark", progress: 35 },
  { name: "Ona tili", short: "ONA", detail: "Grammatika va savodxonlik", color: "fuchsia", icon: "bookText", progress: 76 },
  { name: "Geografiya", short: "GEO", detail: "Materiklar, xaritalar va iqlim", color: "teal", icon: "globe", progress: 43 },
];

const tasks = [
  { id: 1, subject: "Matematika", title: "Kvadrat tenglamalar", meta: "5 ta misol · 20 daqiqa", done: true },
  { id: 2, subject: "Ingliz tili", title: "Present Perfect", meta: "Mashq 4 · 15 daqiqa", done: false },
  { id: 3, subject: "Biologiya", title: "Hujayra tuzilishi", meta: "Mavzuni takrorlash · 10 daqiqa", done: false },
];

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: "home", label: "Umumiy ko‘rinish", icon: "home" },
  { id: "tutor", label: "AI Ustoz", icon: "spark" },
  { id: "homework", label: "Uy vazifalari", icon: "clipboard" },
  { id: "library", label: "Darsliklar", icon: "book" },
  { id: "progress", label: "Natijalarim", icon: "chart" },
];

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20M8 7h8M8 10h6" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M4 16v4h16v-4" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    calculator: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 12h2m4 0h2M8 16h2m4 0h2" /></>,
    atom: <><circle cx="12" cy="12" r="2" /><ellipse cx="12" cy="12" rx="9" ry="4" /><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)" /></>,
    flask: <><path d="M9 3h6M10 3v6l-5.5 9.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 9V3M8 15h8" /></>,
    dna: <><path d="M7 3c0 6 10 12 10 18M17 3C17 9 7 15 7 21M8.5 6h7M7 10h10M7 14h10M8.5 18h7" /></>,
    languages: <><path d="M4 5h12M10 3v2c0 5-3 8-7 10M6 9c1.5 2.5 4 4.5 7 5.5M14 19l3-8 3 8M15 17h4" /></>,
    landmark: <><path d="m3 9 9-6 9 6M4 10h16M5 10v9m4-9v9m6-9v9m4-9v9M3 21h18M2 19h20" /></>,
    bookText: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20M8 7h8M8 10h6M8 17h7" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1ZM8 10h8M8 14h8M8 18h5" /></>,
    chart: <><path d="M4 19V5M4 19h17M8 16v-5m5 5V7m5 9V9" /></>,
    arrowUpRight: <><path d="M7 17 17 7M7 7h10v10" /></>,
    arrowLeft: <><path d="M19 12H5m6-6-6 6 6 6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name] ?? <circle cx="12" cy="12" r="8" />}</svg>;
}

export default function EduPage() {
  const [section, setSection] = useState<Section>("home");
  const [grade, setGrade] = useState("7-sinf");
  const [completed, setCompleted] = useState<number[]>([1]);
  const [subjectQuery, setSubjectQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Matematika");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "student" | "system"; text: string }[]>([]);
  const filteredSubjects = useMemo(() => subjects.filter((s) => (s.name + " " + s.detail).toLowerCase().includes(subjectQuery.toLowerCase())), [subjectQuery]);

  const title = navItems.find((item) => item.id === section)?.label ?? "Umumiy ko‘rinish";
  const toggleTask = (id: number) => setCompleted((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  function sendQuestion() {
    const value = question.trim();
    if (!value) return;
    setMessages((current) => [...current, { role: "student", text: value }, { role: "system", text: "Savolingiz qabul qilindi. AI Ustozning maktab fanlari bo‘yicha javob berish mexanizmi keyingi integratsiya bosqichida ulanadi." }]);
    setQuestion("");
  }

  return (
    <div className="min-h-screen bg-[#f7f7fc] text-[#202033]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[#eceaf5] bg-white px-5 py-6 lg:flex">
        <Link href="/" className="mb-9 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-violet-600 to-indigo-600 text-xl font-black text-white shadow-lg shadow-violet-200">i</span>
          <span><span className="block text-[17px] font-black tracking-tight">IJOD <span className="text-violet-600">EDU</span></span><span className="block text-[9px] font-bold tracking-[.2em] text-slate-400">LEARN WITH AI</span></span>
        </Link>
        <div className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-slate-400">O‘QUV MARKAZI</div>
        <nav className="space-y-1">
          {navItems.map((item) => <button key={item.id} onClick={() => setSection(item.id)} className={"flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition " + (section === item.id ? "bg-violet-50 text-violet-700 shadow-sm shadow-violet-100" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm"><Icon name={item.icon} className="h-[18px] w-[18px]" /></span>{item.label}{section === item.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-600" />}</button>)}
        </nav>
        <div className="mt-8 rounded-2xl bg-[#17152c] p-4 text-white">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-violet-200"><Icon name="spark" className="h-5 w-5" /></div>
          <p className="text-sm font-bold">Har kuni oz-ozdan</p>
          <p className="mt-1 text-[11px] leading-5 text-violet-200/80">Kichik qadamlar katta natijaga olib boradi.</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[62%] rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" /></div>
          <p className="mt-2 text-[10px] text-violet-200/70">Haftalik maqsad · 62%</p>
        </div>
        <div className="mt-auto border-t border-slate-100 pt-4">
          <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-violet-700"><Icon name="arrowLeft" className="h-4 w-4" /> IJOD AI ga qaytish</Link>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#eceaf5] bg-white/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 font-bold text-violet-700 lg:hidden">i</Link>
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">IJOD EDU <span className="mx-1 text-slate-300">/</span> MAKTAB</p><p className="text-sm font-bold text-slate-800">{title}</p></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 sm:flex"><Icon name="calendar" className="h-4 w-4" /> O‘quv rejasi</label>
            <select aria-label="Sinfni tanlash" value={grade} onChange={(e) => setGrade(e.target.value)} className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs font-bold text-violet-700 outline-none focus:ring-2 focus:ring-violet-200">{Array.from({ length: 11 }, (_, i) => <option key={i + 1} value={i + 1 + "-sinf"}>{i + 1}-sinf</option>)}</select>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-cyan-100 text-sm font-black text-violet-700 sm:flex">O‘</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8">
          {section === "home" && <>
            <section className="relative isolate overflow-hidden rounded-[28px] bg-[#17152c] px-6 py-7 text-white shadow-xl shadow-violet-100 sm:px-9 sm:py-9">
              <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-violet-500/30 blur-3xl" />
              <div className="pointer-events-none absolute bottom-[-150px] right-[28%] h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="relative z-10 max-w-[620px]">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-violet-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Sening shaxsiy AI ustozing</span>
                <h1 className="mt-5 text-[30px] font-black leading-[1.12] tracking-tight sm:text-[42px]">Bilim sari har bir qadam <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">muhim.</span></h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">Mavzularni tushun, savollaringni ber va o‘z tezligingda rivojlan. IJOD EDU doim yoningda.</p>
                <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => setSection("tutor")} className="rounded-xl bg-white px-5 py-3 text-xs font-extrabold text-[#211b3d] shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50">AI Ustoz bilan o‘rganish <Icon name="arrowUpRight" className="ml-2 inline h-4 w-4" /></button><button onClick={() => setSection("homework")} className="rounded-xl border border-white/20 px-5 py-3 text-xs font-bold text-white transition hover:bg-white/10">Vazifalarimni ko‘rish</button></div>
              </div>
              <div className="pointer-events-none absolute bottom-[-38px] right-[-12px] hidden h-[300px] w-[330px] items-center justify-center md:flex">
                <div className="absolute h-[240px] w-[240px] rounded-full border border-white/10" /><div className="absolute h-[190px] w-[190px] rounded-full border border-dashed border-violet-200/30" />
                <div className="absolute right-12 top-8 h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_24px_8px_rgba(103,232,249,.35)]" /><div className="absolute bottom-16 left-12 h-3 w-3 rounded-full bg-fuchsia-300 shadow-[0_0_20px_6px_rgba(232,121,249,.35)]" />
                <div className="relative flex h-36 w-36 rotate-[-7deg] items-center justify-center rounded-[34px] border border-white/20 bg-gradient-to-br from-violet-400/30 to-cyan-300/10 shadow-2xl backdrop-blur-xl"><div className="flex h-24 w-24 items-center justify-center rounded-[26px] bg-white text-violet-700 shadow-xl"><Icon name="spark" className="h-12 w-12" /></div></div>
                <div className="absolute bottom-7 right-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-xl"><p className="text-[9px] font-bold uppercase tracking-widest text-violet-200">BUGUNGI NATIJA</p><p className="mt-1 text-xl font-black">+ {completed.length * 20} XP</p></div>
              </div>
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#eceaf5] bg-white p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">Haftalik faollik</span><span className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">+12%</span></div><p className="mt-2 text-2xl font-black">4.5 <span className="text-xs font-semibold text-slate-400">soat</span></p><div className="mt-3 flex h-7 items-end gap-1">{[35,52,42,70,48,88,60].map((h,i)=><div key={i} className="flex-1 rounded-t-md bg-violet-100" style={{height:h+"%"}} />)}</div></div>
              <div className="rounded-2xl border border-[#eceaf5] bg-white p-4"><span className="text-[11px] font-semibold text-slate-500">Bajarilgan vazifalar</span><p className="mt-2 text-2xl font-black">{completed.length}<span className="text-slate-300">/3</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{width:(completed.length/3*100)+"%"}} /></div></div>
              <div className="rounded-2xl border border-[#eceaf5] bg-white p-4"><span className="text-[11px] font-semibold text-slate-500">O‘rganilgan fanlar</span><p className="mt-2 text-2xl font-black">8 <span className="text-xs font-semibold text-slate-400">fan</span></p><div className="mt-3 flex gap-1.5">{subjects.slice(0,8).map((s)=><span key={s.short} title={s.name} className={"h-2 flex-1 rounded-full " + (s.color==="violet"?"bg-violet-400":s.color==="sky"?"bg-sky-400":s.color==="emerald"?"bg-emerald-400":s.color==="lime"?"bg-lime-400":s.color==="amber"?"bg-amber-400":s.color==="rose"?"bg-rose-400":s.color==="fuchsia"?"bg-fuchsia-400":"bg-teal-400")} />)}</div></div>
            </section>

            <section className="mt-9">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-600">O‘ZINGGA MOS TANLA</p><h2 className="mt-1 text-xl font-black tracking-tight">Qaysi fandan boshlaymiz?</h2><p className="mt-1 text-xs text-slate-500">Fan kartasini tanlab, o‘rganishni boshlashing mumkin.</p></div><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><Icon name="search" className="h-4 w-4 text-slate-400" /><input value={subjectQuery} onChange={(e)=>setSubjectQuery(e.target.value)} placeholder="Fanni qidirish..." className="w-36 bg-transparent text-xs outline-none sm:w-48" /></label></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{filteredSubjects.map((subject)=><button key={subject.name} onClick={()=>{setSelectedSubject(subject.name);setSection("tutor");}} className="group rounded-2xl border border-[#eceaf5] bg-white p-4 text-left transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-100/60"><div className="flex items-start justify-between"><span className={"flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black " + (subject.color==="violet"?"bg-violet-50 text-violet-700":subject.color==="sky"?"bg-sky-50 text-sky-700":subject.color==="emerald"?"bg-emerald-50 text-emerald-700":subject.color==="lime"?"bg-lime-50 text-lime-700":subject.color==="amber"?"bg-amber-50 text-amber-700":subject.color==="rose"?"bg-rose-50 text-rose-700":subject.color==="fuchsia"?"bg-fuchsia-50 text-fuchsia-700":"bg-teal-50 text-teal-700")}><Icon name={subject.icon} className="h-6 w-6" /></span><Icon name="arrowUpRight" className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" /></div><p className="mt-4 text-sm font-extrabold">{subject.name}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{subject.detail}</p><div className="mt-4 flex items-center justify-between text-[10px]"><span className="text-slate-400">O‘zlashtirish</span><span className="font-bold text-slate-600">{subject.progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{width:subject.progress+"%"}} /></div></button>)}</div>
            </section>

            <section className="mt-9 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
              <div className="rounded-2xl border border-[#eceaf5] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-600">BUGUNGI REJA</p><h2 className="mt-1 text-lg font-black">Kichik qadamlar, katta natija</h2></div><button onClick={()=>setSection("homework")} className="text-[11px] font-bold text-violet-700 hover:underline">Barchasi →</button></div><div className="mt-4 space-y-2">{tasks.map((task)=><button key={task.id} onClick={()=>toggleTask(task.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-violet-100 hover:bg-violet-50/40"><span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs " + (completed.includes(task.id)?"border-emerald-500 bg-emerald-500 text-white":"border-slate-300 text-transparent")}>✓</span><span className="min-w-0 flex-1"><span className={"block text-xs font-bold "+(completed.includes(task.id)?"text-slate-400 line-through":"text-slate-800")}>{task.title}</span><span className="mt-1 block text-[10px] text-slate-400">{task.subject} · {task.meta}</span></span><span className="text-[10px] font-semibold text-slate-400">{completed.includes(task.id)?"Bajarildi":"Kutilmoqda"}</span></button>)}</div></div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#e9e4ff] via-[#f3efff] to-[#e3f7f8] p-5"><div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/70 blur-2xl" /><div className="relative"><span className="inline-flex rounded-lg bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-violet-700">AI USTOZ TAVSIYASI</span><div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm"><Icon name="spark" className="h-6 w-6" /></div><h3 className="mt-4 max-w-xs text-lg font-black leading-snug">Tushunmagan joyingni so‘rashdan qo‘rqma.</h3><p className="mt-2 max-w-xs text-xs leading-5 text-slate-600">AI Ustoz mavzuni senga mos tezlikda, sodda misollar bilan tushuntirishga yordam beradi.</p><button onClick={()=>setSection("tutor")} className="mt-5 inline-flex items-center rounded-xl bg-[#25203f] px-4 py-3 text-[11px] font-bold text-white transition hover:bg-violet-700">Ustoz bilan suhbatlashish <Icon name="arrowUpRight" className="ml-2 h-4 w-4" /></button></div></div>
            </section>
          </>}

          {section === "tutor" && <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><div className="rounded-3xl bg-[#17152c] p-6 text-white"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-200">SHAXSIY YORDAMCHI</span><div className="mt-7 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-violet-300 to-cyan-200 text-[#211b3d]"><Icon name="spark" className="h-8 w-8" /></div><h1 className="mt-5 text-2xl font-black">Salom! Men sening AI Ustozingman.</h1><p className="mt-3 text-sm leading-6 text-slate-300">Qaysi mavzu qiyin bo‘lyapti? Birgalikda, bosqichma-bosqich o‘rganamiz.</p><div className="mt-6 rounded-2xl border border-white/10 bg-white/[.06] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">TANLANGAN FAN</p><p className="mt-1 text-lg font-bold">{selectedSubject}</p><p className="mt-1 text-xs text-slate-400">{grade} darajasi uchun tushuntirish</p></div></div><div className="flex min-h-[520px] flex-col rounded-3xl border border-[#eceaf5] bg-white p-5"><div className="border-b border-slate-100 pb-4"><h2 className="text-lg font-black">Ustoz bilan suhbat</h2><p className="mt-1 text-xs text-slate-400">Savolingni yoz yoki tayyor mavzulardan birini tanla.</p></div><div className="flex-1 space-y-3 overflow-y-auto py-5">{messages.length===0?<div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Icon name="spark" className="h-7 w-7" /></div><p className="mt-4 text-sm font-bold">Bugun nimani o‘rganamiz?</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Savolingni yubor yoki quyidagi takliflardan birini tanla.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["Mavzuni sodda tushuntir","Misolni bosqichma-bosqich yech","Menga 5 ta test ber"].map((v)=><button key={v} onClick={()=>setQuestion(v)} className="rounded-full border border-violet-100 bg-violet-50/60 px-3 py-2 text-[10px] font-semibold text-violet-700 hover:bg-violet-100">{v}</button>)}</div></div>:messages.map((m,i)=><div key={i} className={"max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-5 "+(m.role==="student"?"ml-auto bg-violet-600 text-white":"bg-slate-50 text-slate-600")}>{m.text}</div>)}</div><div className="rounded-2xl border border-slate-200 p-2"><textarea value={question} onChange={(e)=>setQuestion(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendQuestion();}}} rows={2} placeholder="Savolingni shu yerga yoz..." className="w-full resize-none bg-transparent px-2 py-1 text-xs outline-none placeholder:text-slate-400" /><div className="flex items-center justify-between px-1"><span className="text-[10px] text-slate-400">Enter — yuborish · Shift + Enter — yangi qator</span><button onClick={sendQuestion} disabled={!question.trim()} className="rounded-xl bg-violet-600 px-4 py-2 text-[10px] font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">Yuborish <Icon name="arrowUpRight" className="ml-1 inline h-3.5 w-3.5" /></button></div></div><p className="mt-2 text-center text-[9px] text-slate-400">Hozircha suhbat interfeysi. AI fan dvigateli integratsiya bosqichida ulanadi.</p></div></section>}

          {section === "homework" && <section className="rounded-3xl border border-[#eceaf5] bg-white p-6 sm:p-8"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-600">TOPSHIRIQLAR MARKAZI</p><h1 className="mt-2 text-2xl font-black">Uy vazifalarim</h1><p className="mt-2 text-sm text-slate-500">Vazifalaringni kuzat, bajarganingni belgilab bor.</p><div className="mt-6 space-y-3">{tasks.map((task)=><div key={task.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-4"><button onClick={()=>toggleTask(task.id)} className={"flex h-8 w-8 items-center justify-center rounded-full border "+(completed.includes(task.id)?"border-emerald-500 bg-emerald-500 text-white":"border-slate-300 text-slate-300")}>✓</button><div className="min-w-0 flex-1"><p className="text-sm font-bold">{task.title}</p><p className="mt-1 text-xs text-slate-400">{task.subject} · {task.meta}</p></div><span className={"rounded-full px-3 py-1 text-[10px] font-bold "+(completed.includes(task.id)?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700")}>{completed.includes(task.id)?"Bajarildi":"Bajarish kerak"}</span></div>)}</div><div className="mt-6 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-6 text-center"><Icon name="upload" className="mx-auto h-7 w-7 text-violet-500" /><p className="mt-3 text-sm font-bold">Topshiriq rasmini yuborish</p><p className="mt-1 text-xs text-slate-500">Daftar yoki darslikdagi savolni suratga olib yuborish imkoniyati AI Vision integratsiyasida ulanadi.</p><button onClick={()=>setSection("tutor")} className="mt-4 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white">AI Ustozga o‘tish</button></div></section>}

          {section === "library" && <section><div className="rounded-3xl bg-gradient-to-r from-[#eae5ff] to-[#e5f7f7] p-6 sm:p-8"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-700">BILIMLAR KUTUBXONASI</p><h1 className="mt-2 text-2xl font-black">Darsliklar va mavzular</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Sinf va fan bo‘yicha kerakli materiallarni bir joydan top. Darsliklar kutubxonasi kontent bilan to‘ldirilgach, shu yerda ko‘rinadi.</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{subjects.map(s=><button key={s.name} onClick={()=>{setSelectedSubject(s.name);setSection("tutor");}} className="rounded-2xl border border-[#eceaf5] bg-white p-4 text-left hover:border-violet-200 hover:shadow-lg"><span className="text-violet-600"><Icon name={s.icon} className="h-6 w-6" /></span><p className="mt-3 text-sm font-bold">{s.name}</p><p className="mt-1 text-[10px] text-slate-400">{grade} · Darsliklar va mavzular</p></button>)}</div></section>}

          {section === "progress" && <section className="rounded-3xl border border-[#eceaf5] bg-white p-6 sm:p-8"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-600">SHAXSIY O‘SISH</p><h1 className="mt-2 text-2xl font-black">Mening natijalarim</h1><p className="mt-2 text-sm text-slate-500">O‘quv jarayoning va fanlar bo‘yicha o‘zlashtirish holati.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{subjects.map(s=><div key={s.name} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold">{s.name}</p><p className="mt-3 text-2xl font-black text-violet-700">{s.progress}%</p><div className="mt-3 h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{width:s.progress+"%"}} /></div></div>)}</div><p className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">Ko‘rsatkichlar hozircha namuna ma’lumotlari. Haqiqiy natijalar o‘quvchi faoliyati va testlar bilan integratsiya qilingach hisoblanadi.</p></section>}

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-6 text-[10px] text-slate-400"><span>© 2026 IJOD EDU · IJOD AI ekotizimi</span><span>O‘rganish — bu sayohat.</span></footer>
        </div>
      </main>
    </div>
  );
}
