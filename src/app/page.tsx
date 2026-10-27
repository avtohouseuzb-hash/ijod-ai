
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const tools = [
  { icon: "✳", title: "AI Rasm", desc: "G‘oyangizdan ajoyib rasmlar yarating", color: "bg-violet-100 text-violet-700", tag: "Mashhur" },
  { icon: "▶", title: "AI Video", desc: "Matn va rasmlardan video yarating", color: "bg-pink-100 text-pink-700", tag: "Yangi" },
  { icon: "♫", title: "AI Ovoz", desc: "Matnni ovozga va nutqqa aylantiring", color: "bg-amber-100 text-amber-700", tag: "" },
  { icon: "Aa", title: "AI Matn", desc: "Post, reklama va ssenariy yozing", color: "bg-sky-100 text-sky-700", tag: "" },
  { icon: "◈", title: "AI Dizayn", desc: "Instagram post, reklama banneri va marketing dizaynlari", color: "bg-emerald-100 text-emerald-700", tag: "Yangi" },
  { icon: "◎", title: "AI Tarjima", desc: "Matn va kontentni boshqa tillarga tarjima qiling", color: "bg-orange-100 text-orange-700", tag: "" },
  { icon: "🛍", title: "AI Mahsulot sotuvchi", desc: "Marketplace uchun mahsulot kartasi, SEO va reklama paketi", color: "bg-fuchsia-100 text-fuchsia-700", tag: "Biznes" },
  { icon: "▦", title: "AI Kontent-reja", desc: "7 kunlik kontent reja, post va Reels g‘oyalari", color: "bg-cyan-100 text-cyan-700", tag: "Yangi" },
  { icon: "↗", title: "AI Marketing maslahatchi", desc: "Reklama variantlari, auditoriya va A/B test", color: "bg-lime-100 text-lime-700", tag: "Biznes" },
  { icon: "✦", title: "AI Brend yaratish", desc: "Brend pozitsiyasi, slogan, ranglar va Instagram bio", color: "bg-rose-100 text-rose-700", tag: "Yangi" },
  { icon: "▤", title: "AI Hujjat yordamchisi", desc: "Matn va hujjatlarni qisqartirish, tushuntirish va qayta yozish", color: "bg-blue-100 text-blue-700", tag: "" },
  { icon: "▶", title: "AI Reels ssenariy paketi", desc: "Kadrlar, subtitr matni, voiceover va CTA bilan ssenariy", color: "bg-amber-100 text-amber-700", tag: "" },
  { icon: "👗", title: "AI Virtual Kiyintirish", desc: "Kiyim, oyoq kiyim va aksessuarlarni AI modelga kiydiring", color: "bg-violet-100 text-violet-700", tag: "Yangi" },
];

export default function Home() {
  const [active, setActive] = useState("Bosh sahifa");
  const [query, setQuery] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUserEmail(data.session?.user.email ?? null);
        setAuthLoading(false);
        if (data.session) void loadCredits();
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setAuthLoading(false);
      if (session) void loadCredits();
      else setCredits(null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function loadCredits() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("credits")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!error && typeof data?.credits === "number") setCredits(data.credits);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUserEmail(null);
  }

  const filteredTools = tools.filter((tool) =>
    `${tool.title} ${tool.desc}`.toLowerCase().includes(query.toLowerCase())
  );

  const menu = [
    { name: "Bosh sahifa", icon: "⌂" },
    { name: "Tariflar", icon: "✦" },
    { name: "AI vositalar", icon: "✳" },
    { name: "Mening loyihalarim", icon: "▤" },
    { name: "Sevimlilar", icon: "♡" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-[#191923]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[250px] flex-col border-r border-gray-200 bg-white px-5 py-6 lg:flex">
        <a href="#" aria-label="IJOD AI bosh sahifa" className="mb-10 flex flex-col items-start gap-1">
          <img src="/ijod-logo-v2.svg" alt="IJOD AI" className="h-auto w-[158px] object-contain" />
          <span className="pl-1 text-[9px] tracking-[.18em] text-gray-400">CREATIVE SUPERAPP</span>
        </a>

        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-gray-400">MENYU</div>
        <nav className="space-y-1">
          {menu.map((item) => (
            <button
              key={item.name}
              onClick={() => { setActive(item.name); window.scrollTo({ top: 0, behavior: "smooth" }); setMobileMenuOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                active === item.name
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="w-5 text-center text-lg">{item.icon}</span>
              {item.name}
              {item.name === "AI vositalar" && <span className="ml-auto text-xs text-gray-400">6</span>}
            </button>
          ))}
        </nav>

        <div className="mt-9 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-4 text-white">
          <div className="mb-2 text-xl">✦</div>
          <div className="text-sm font-bold">Tasavvuringizni yarating</div>
          <p className="mt-1 text-xs leading-5 text-violet-100">AI yordamida g‘oyalaringizni hayotga olib keling.</p>
          <button onClick={() => { setActive("AI vositalar"); document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" }); }} className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50">
            Boshlash →
          </button>
        </div>

        <div className="relative mt-auto border-t border-gray-100 pt-4">
          <button type="button" onClick={() => setProfileMenuOpen((v) => !v)} aria-expanded={profileMenuOpen} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-50">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">👤</div>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{userEmail ? "Hisobim" : "Mehmon"}</div><div className="truncate text-xs text-gray-400">{userEmail || "Hisob ulanmagan"}</div></div><span className="text-gray-400">⋯</span>
          </button>
          {profileMenuOpen && <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
            {userEmail ? <button onClick={handleSignOut} className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Hisobdan chiqish</button> : <Link href="/login" onClick={() => setProfileMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-violet-700 hover:bg-violet-50">Kirish / Ro‘yxatdan o‘tish ↗</Link>}
          </div>}
        </div>
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 z-40 lg:hidden">
        <button aria-label="Menyuni yopish" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-black/30" />
        <aside className="absolute inset-y-0 left-0 flex w-[min(84vw,300px)] flex-col bg-white px-5 py-6 shadow-2xl">
          <div className="mb-8 flex items-center justify-between"><div className="flex items-center gap-2"><img src="/ijod-logo-v2.svg" alt="IJOD AI" className="h-11 w-[105px] object-contain" /></div><button onClick={() => setMobileMenuOpen(false)} aria-label="Yopish" className="rounded-lg px-3 py-1 text-2xl text-gray-500">×</button></div>
          <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-gray-400">MENYU</div>
          <nav className="space-y-1">{menu.map((item) => <button key={item.name} onClick={() => { setActive(item.name); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={"flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium " + (active === item.name ? "bg-violet-50 text-violet-700" : "text-gray-600 hover:bg-gray-50")}><span className="w-5 text-center text-lg">{item.icon}</span>{item.name}{item.name === "AI vositalar" && <span className="ml-auto text-xs text-gray-400">{tools.length}</span>}</button>)}</nav>
          <div className="mt-8 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-4 text-white"><div className="mb-2 text-xl">✦</div><div className="text-sm font-bold">Tasavvuringizni yarating</div><p className="mt-1 text-xs leading-5 text-violet-100">AI yordamida g‘oyalaringizni hayotga olib keling.</p><button onClick={() => { setActive("AI vositalar"); setMobileMenuOpen(false); document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" }); }} className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-bold text-violet-700">Boshlash →</button></div>
          <div className="mt-auto border-t border-gray-100 pt-4"><div className="mb-2 px-2 text-sm font-semibold">{userEmail || "Mehmon"}</div>{userEmail ? <button onClick={handleSignOut} className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50">Hisobdan chiqish</button> : <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">Kirish / Ro‘yxatdan o‘tish ↗</Link>}</div>
        </aside>
      </div>}
      <main className="min-h-screen lg:ml-[250px]">
        <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-gray-200/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <button type="button" aria-label="Menyuni ochish" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl text-gray-800 shadow-sm">{mobileMenuOpen ? "×" : "☰"}</button>
            <img src="/ijod-logo-v2.svg?v=3" alt="IJOD AI" className="h-11 w-[112px] object-contain object-left" />
          </div>
          <div className="hidden text-sm text-gray-400 lg:block">Ijod qiling <span className="mx-2">/</span> <span className="font-semibold text-gray-800">{active}</span></div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-xs text-gray-500 sm:flex">
              <span className="text-amber-500">✦</span> {credits === null ? "— kredit" : `${credits} kredit`}
            </div>
            {userEmail ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-[180px] truncate text-xs text-gray-500 sm:block">{userEmail}</span>
                <button onClick={handleSignOut} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-violet-300 hover:text-violet-700">Chiqish</button>
              </div>
            ) : (
              <Link href="/login" className="rounded-xl bg-[#191923] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-700">{authLoading ? "Tekshirilmoqda..." : "Kirish ↗"}</Link>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
          {(active === "Bosh sahifa" || active === "AI vositalar") && <>
          <section className="relative overflow-hidden rounded-[28px] bg-[#171326] px-6 py-9 text-white sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute -right-10 -top-24 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="relative max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-xs text-violet-200">
                <span>✦</span> Sun’iy intellekt — yangi ijod davri
              </div>
              <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                G‘oyangizni <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">ijodga</span> aylantiring.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-gray-300 sm:text-base">
                Rasm, video, ovoz va matn yaratish uchun barcha AI vositalari — bitta platformada.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#211638] transition hover:bg-violet-100">
                  Ijodni boshlash <span className="ml-2">→</span>
                </button>
                <button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Qanday ishlaydi?
                </button>
              </div>
            </div>
            <div className="relative mt-8 grid max-w-lg grid-cols-3 gap-3 sm:absolute sm:bottom-10 sm:right-8 sm:mt-0 sm:w-[330px]">
              <div className="flex aspect-square flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/30 to-violet-500/10 p-3">
                <span className="text-2xl">✺</span><span className="text-xs text-violet-100">Tasvir</span>
              </div>
              <div className="mt-5 flex aspect-square flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-sky-500/30 to-indigo-500/10 p-3">
                <span className="text-2xl">▶</span><span className="text-xs text-sky-100">Video</span>
              </div>
              <div className="flex aspect-square flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/30 to-pink-500/10 p-3">
                <span className="text-2xl">♫</span><span className="text-xs text-amber-100">Ovoz</span>
              </div>
            </div>
          </section>

          <section className="mt-9" id="tools">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">IJOD LABORATORIYASI</div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Nima yaratmoqchisiz?</h2>
                <p className="mt-2 text-sm text-gray-500">O‘zingizga mos AI vositasini tanlang.</p>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:w-64">
                <span className="text-gray-400">⌕</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Vositalarni qidirish..." className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400" />
              </label>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTools.map((tool) => (
                <button key={tool.title} disabled={tool.title === "AI Video"} onClick={() => {
                  if (tool.title === "AI Video") return;
                  const routes: Record<string, string> = {
                    "AI Rasm": "/tools/image",
                    "AI Dizayn": "/tools/design",
                    "AI Video": "/tools/video",
                    "AI Ovoz": "/tools/audio",
                    "AI Matn": "/tools/text",
                    "AI Tarjima": "/tools/translate",
                    "AI Mahsulot sotuvchi": "/tools/business?mode=product",
                    "AI Kontent-reja": "/tools/business?mode=content",
                    "AI Marketing maslahatchi": "/tools/business?mode=marketing",
                    "AI Brend yaratish": "/tools/business?mode=brand",
                    "AI Hujjat yordamchisi": "/tools/business?mode=document",
                    "AI Reels ssenariy paketi": "/tools/business?mode=reels",
                    "AI Virtual Kiyintirish": "/tools/virtual-tryon",
                  };
                  const route = routes[tool.title];
                  if (route) window.location.href = route;
                  else alert(`${tool.title} tez orada ishga tushadi!`);
                }} className={`group relative rounded-2xl border border-gray-200/80 bg-white p-5 text-left transition duration-200 ${tool.title === "AI Video" ? "cursor-not-allowed border-pink-100" : "hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-100/50"}`}>
                  <div className={tool.title === "AI Video" ? "pointer-events-none select-none blur-[2px] opacity-60" : ""}>
                    <div className="flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold ${tool.color}`}>{tool.icon}</div>
                      {tool.tag && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${tool.tag === "Yangi" ? "bg-pink-50 text-pink-600" : "bg-violet-50 text-violet-600"}`}>{tool.tag}</span>}
                    </div>
                    <h3 className="mt-5 font-bold">{tool.title}</h3>
                    <p className="mt-2 min-h-10 text-sm leading-5 text-gray-500">{tool.desc}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-semibold text-gray-500">
                      Ochish <span className="text-base">→</span>
                    </div>
                  </div>
                  {tool.title === "AI Video" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/30"><span className="rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-bold text-pink-700 shadow-sm">Tez orada</span></div>}
                </button>
              ))}
            </div>
            {filteredTools.length === 0 && <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-gray-500">Mos vosita topilmadi. Boshqa so‘z bilan qidiring.</p>}
          </section>

          <section id="how" className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
            <div className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">JUDAYAM OSON</div>
            <h2 className="mt-2 text-2xl font-bold">Uch qadamda ijod qiling</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {[
                ["01", "Vosita tanlang", "Rasm, video, ovoz yoki matn turini tanlang."],
                ["02", "G‘oyangizni yozing", "Nima yaratmoqchi ekaningizni tushuntiring."],
                ["03", "Natijani oling", "Yaratilgan natijani ko‘ring va saqlang."],
              ].map(([number, title, desc]) => (
                <div key={number} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-sm font-black text-violet-700">{number}</div>
                  <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-5 text-gray-500">{desc}</p></div>
                </div>
              ))}
            </div>
          </section>

          </>}
          {active === "Mening loyihalarim" && <section className="rounded-3xl border border-gray-200 bg-white p-8 sm:p-12">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-700">▤</div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">IJOD LABORATORIYASI</p>
            <h1 className="mt-2 text-3xl font-black">Mening loyihalarim</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">AI yordamida yaratgan ishlaringiz shu yerda ko‘rinadi. Hozircha saqlangan loyiha yo‘q.</p>
            <button onClick={() => { setActive("AI vositalar"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-6 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700">AI vositalarni ko‘rish →</button>
          </section>}
          {active === "Sevimlilar" && <section className="rounded-3xl border border-gray-200 bg-white p-8 sm:p-12">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100 text-2xl text-pink-600">♡</div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">SHAXSIY RO‘YXAT</p>
            <h1 className="mt-2 text-3xl font-black">Sevimlilar</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">Tez-tez ishlatadigan AI vositalaringizni keyinroq tez topish uchun shu yerda saqlash mumkin. Hozircha sevimlilarga qo‘shilgan vosita yo‘q.</p>
            <button onClick={() => { setActive("AI vositalar"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-6 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700">AI vositalarni ko‘rish →</button>
          </section>}
          {active === "Tariflar" && <section className="space-y-8">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">IJOD AI TARIFLARI</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">O‘zingizga mos tarifni tanlang</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500">Kreditlarni xarid qiling va ularni AI vositalarida o‘zingizga kerakli natijalarni yaratish uchun ishlating.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { name: "Mini", price: "5 000", credits: 10, unit: "500 so‘m / kredit", desc: "IJOD AI bilan tanishish uchun", featured: false },
                { name: "Start", price: "15 000", credits: 30, unit: "500 so‘m / kredit", desc: "Doimiy foydalanishni boshlang", featured: false },
                { name: "Pro", price: "29 000", credits: 60, unit: "483 so‘m / kredit", desc: "Ko‘proq ijod, yaxshiroq qiymat", featured: true },
                { name: "Business", price: "59 000", credits: 130, unit: "454 so‘m / kredit", desc: "Faol ijodkorlar va biznes uchun", featured: false },
              ].map((plan) => (
                <article key={plan.name} className={"relative flex flex-col rounded-3xl border bg-white p-6 transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:border-violet-300 hover:shadow-2xl hover:shadow-violet-200/60 motion-reduce:transform-none " + (plan.featured ? "border-violet-500 shadow-xl shadow-violet-100 ring-1 ring-violet-500" : "border-gray-200 shadow-sm")}>
                  {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold text-white">OMMABOP</span>}
                  <h2 className="text-lg font-bold">{plan.name}</h2>
                  <p className="mt-2 text-sm text-gray-500">{plan.desc}</p>
                  <div className="mt-6 flex items-baseline gap-1"><span className="text-3xl font-black tracking-tight">{plan.price}</span><span className="text-sm text-gray-500">so‘m</span></div>
                  <div className="mt-4 rounded-xl bg-violet-50 px-4 py-3"><span className="text-2xl font-black text-violet-700">{plan.credits}</span><span className="ml-2 text-sm font-semibold text-violet-700">kredit</span></div>
                  <p className="mt-3 text-xs text-gray-500">{plan.unit}</p>
                  <button onClick={() => { if (!userEmail) { window.location.href = "/login"; return; } alert("Kredit xaridi tez orada ulanadi. Hozircha to‘lov tizimi sozlanmoqda."); }} className={"mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold transition " + (plan.featured ? "bg-violet-600 text-white hover:bg-violet-700" : "border border-gray-200 text-gray-700 hover:border-violet-300 hover:text-violet-700")}>Tarifni tanlash</button>
                </article>
              ))}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-bold">Kreditlar qanday sarflanadi?</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">Xizmatga qarab kredit sarfi farq qiladi. Quyidagi qiymatlar boshlang‘ich tariflar bo‘lib, xizmatlarning haqiqiy AI xarajatlari tekshirilgach yangilanishi mumkin.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["AI matn / post", "1 kreditdan"],
                  ["Reels ssenariysi", "2 kreditdan"],
                  ["Kontent-reja", "3 kreditdan"],
                  ["AI ovoz", "3–5 kredit"],
                  ["AI rasm", "20 kredit"],
                  ["Logo / brend", "25 kredit"],
                  ["Mahsulot kartochkasi", "25 kredit"],
                  ["AI video · 6 soniya", "35 kredit"],
                  ["AI video · 10 soniya", "70 kredit"],
                ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3"><span className="text-sm text-gray-600">{label}</span><span className="whitespace-nowrap text-sm font-bold text-violet-700">{value}</span></div>)}
              </div>
              <p className="mt-4 text-xs leading-5 text-gray-400">Eslatma: kredit paketlari narxlari ko‘rsatilgan. To‘lovni amalga oshirish funksiyasi alohida to‘lov provayderi integratsiyasini talab qiladi.</p>
            </div>
          </section>}
          <footer className="flex flex-col justify-between gap-2 py-8 text-xs text-gray-400 sm:flex-row">
            <span>© 2026 IJOD AI. Barcha huquqlar himoyalangan.</span>
            <span>O‘zbekistonda yaratilgan ✦</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
