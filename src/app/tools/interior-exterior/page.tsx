"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DesignMode = "interior" | "exterior";
type Budget = "Tejamkor" | "O‘rtacha" | "Premium";
type Style = { name: string; description: string; image: string };

const interiorStyles: Style[] = [
  { name: "Neo Classic", description: "Klassik naqshlar, nafis mebel va hashamatli detallar", image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=700&q=85" },
  { name: "Modern", description: "Zamonaviy shakllar, marmar va uyg‘un yoritish", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85" },
  { name: "Minimalism", description: "Soddalik, och ranglar va ortiqcha buyumlarsiz makon", image: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=700&q=85" },
  { name: "Scandinavian", description: "Tabiiy yog‘och, yorug‘lik va qulaylik", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85" },
  { name: "Japandi", description: "Yapon soddaligi va skandinav iliqligi", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700&q=85" },
  { name: "Art Deco", description: "Geometrik naqshlar, metall va hashamat", image: "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=700&q=85" },
];
const exteriorStyles: Style[] = [
  { name: "Hi-Tech", description: "Shisha, metall va geometrik fasad", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85" },
  { name: "Neo Classic", description: "Simmetriya, ustunlar va klassik bezaklar", image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=85" },
  { name: "Minimalist", description: "Toza chiziqlar va sodda arxitektura", image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=700&q=85" },
  { name: "Mediterranean", description: "Tabiiy tosh, iliq ranglar va janubiy kayfiyat", image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=700&q=85" },
  { name: "Modern Classic", description: "Klassik proporsiyalar va zamonaviy materiallar", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85" },
  { name: "Modern Farmhouse", description: "Yog‘och, tosh va sokin qishloqona uslub", image: "https://images.unsplash.com/photo-1600047509782-20d39509f26d?w=700&q=85" },
];
const roomTypes = ["Mehmonxona", "Yotoqxona", "Oshxona", "Hammom", "Bolalar xonasi", "Ish xonasi", "Koridor", "Boshqa"];
const budgets: { name: Budget; hint: string }[] = [
  { name: "Tejamkor", hint: "Oddiy va hamyonbop materiallar" },
  { name: "O‘rtacha", hint: "Narx va sifat muvozanati" },
  { name: "Premium", hint: "Yuqori sifatli material va mebel" },
];

export default function InteriorExteriorDesignPage() {
  const [mode, setMode] = useState<DesignMode>("interior");
  const [style, setStyle] = useState("Neo Classic");
  const [room, setRoom] = useState("Mehmonxona");
  const [budget, setBudget] = useState<Budget>("O‘rtacha");
  const [requirements, setRequirements] = useState("");
  const [sourceImage, setSourceImage] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [resultImage, setResultImage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [showCompare, setShowCompare] = useState(false);

  const styles = mode === "interior" ? interiorStyles : exteriorStyles;
  const selectedStyle = useMemo(() => styles.find((item) => item.name === style) ?? styles[0], [styles, style]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(Boolean(data.session));
      setAuthChecking(false);
      if (data.session) void loadCredits();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setAuthChecking(false);
      if (session) void loadCredits();
      else setCredits(null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function loadCredits() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("profiles").select("credits").eq("user_id", session.user.id).maybeSingle();
    if (typeof data?.credits === "number") setCredits(data.credits);
  }

  function handleImage(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Faqat JPG, PNG yoki WEBP formatidagi rasmni yuklang.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Rasm hajmi 10 MB dan oshmasin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(typeof reader.result === "string" ? reader.result : "");
      setSourceName(file.name);
      setResultImage("");
      setError("");
    };
    reader.onerror = () => setError("Rasmni o‘qib bo‘lmadi. Boshqa rasm tanlang.");
    reader.readAsDataURL(file);
  }

  async function generateDesign() {
    if (!sourceImage || loading) return;
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Dizayn yaratish uchun avval hisobingizga kiring.");
      const subject = mode === "interior" ? `Interior room: ${room}` : "Exterior architecture and building facade";
      const prompt = `Transform the uploaded real photo into a photorealistic ${subject} redesign in the ${selectedStyle.name} style. Budget level: ${budget}. Style guidance: ${selectedStyle.description}. Preserve the original room/building identity, camera viewpoint, perspective, room dimensions, wall positions, windows, doors, structural openings and recognizable architecture. Do not change the number or position of windows and doors. Redesign finishes, colors, lighting, furniture, decor and non-structural details to match the selected style. ${mode === "exterior" ? "Keep the building footprint and structural form recognizable; redesign facade materials, exterior colors, entrance details, garden and outdoor lighting only where appropriate." : "Keep the room layout and structural elements recognizable; redesign furniture, wall finishes, ceiling details, flooring, curtains and lighting."} Budget direction: ${budget === "Tejamkor" ? "cost-conscious, practical finishes and accessible furniture" : budget === "Premium" ? "premium natural materials, bespoke details and high-end furniture" : "balanced mid-range materials and furniture"}. Additional user requirements: ${requirements.trim() || "Use your design judgement and keep the result functional and elegant."}. Output one highly realistic architectural interior/exterior photograph, not a collage, not a drawing, no text, no labels, no watermark.`;
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          prompt,
          size: "1024x1024",
          imageDataUrl: sourceImage,
          service: "AI Interyer & Eksteryer Design",
          title: `${mode === "interior" ? room : "Fasad"} · ${selectedStyle.name}`,
        }),
      });
      const data: { image?: string; error?: string; remainingCredits?: number } = await response.json();
      if (!response.ok) throw new Error(data.error || "Dizayn yaratishda xatolik yuz berdi.");
      if (!data.image) throw new Error("Dizayn natijasi bo‘sh qaytdi.");
      setResultImage(data.image);
      setShowCompare(false);
      if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ulanishda xatolik. Qayta urinib ko‘ring.");
      void loadCredits();
    } finally {
      setLoading(false);
    }
  }

  if (authChecking) return <main className="flex min-h-screen items-center justify-center bg-[#09090d] text-gray-400">Hisobingiz tekshirilmoqda...</main>;
  if (!signedIn) return <main className="min-h-screen bg-[#09090d] p-6 text-white"><section className="mx-auto mt-16 max-w-md rounded-3xl border border-white/10 bg-[#15151d] p-8 text-center"><h1 className="text-2xl font-black">IJOD AI’ga kiring</h1><p className="mt-3 text-sm text-gray-400">AI Interyer & Eksteryer Design vositasidan foydalanish uchun hisobingizga kiring.</p><Link className="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold text-white" href="/login">Kirish →</Link></section></main>;

  return (
    <main className="min-h-screen bg-[#09090d] px-3 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-violet-300 hover:text-white">← Bosh sahifa</Link>
          <div className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm text-gray-300">✦ {credits === null ? "Kredit tekshirilmoqda..." : `${credits} kredit`}</div>
        </div>

        <header className="relative isolate overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-r from-[#211532] via-[#211a35] to-[#171c2a] p-6 sm:p-8">
          <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,.24),transparent_65%)] lg:block" />
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-violet-300">IJOD AI · DESIGN STUDIO</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">AI Interyer & Eksteryer Design</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">Xona yoki bino rasmini yuklang, uslubni tanlang va makoningizni yangi dizaynda ko‘ring.</p>
          </div>
          <div className="pointer-events-none absolute -bottom-16 right-8 hidden h-52 w-52 rounded-full border border-violet-300/20 lg:block" />
        </header>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(440px,.92fr)_minmax(0,1.08fr)]">
          <section className="rounded-[24px] border border-white/10 bg-[#131319] p-4 sm:p-6">
            <div className="grid grid-cols-2 rounded-2xl bg-[#202027] p-1">
              <button type="button" onClick={() => { setMode("interior"); setStyle("Neo Classic"); setResultImage(""); }} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === "interior" ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>▣ Interyer dizayn</button>
              <button type="button" onClick={() => { setMode("exterior"); setStyle("Hi-Tech"); setResultImage(""); }} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === "exterior" ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>▦ Eksteryer dizayn</button>
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-bold">1. {mode === "interior" ? "Xona" : "Bino"} rasmini yuklang</h2>
              <label className="mt-3 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-violet-400/50 bg-[#1b1b24] p-5 text-center transition hover:border-violet-300 hover:bg-[#22212d]">
                {sourceImage ? <img src={sourceImage} alt="Yuklangan asl rasm" className="max-h-64 w-full rounded-xl object-contain" /> : <><span className="text-4xl text-violet-300">▧</span><span className="mt-3 text-sm font-semibold">Rasmni bu yerga tortib tashlang</span><span className="mt-1 text-xs text-gray-500">yoki <span className="text-violet-300 underline">fayl tanlang</span></span><span className="mt-3 text-[11px] text-gray-500">JPG, PNG, WEBP · Maks. 10 MB</span></>}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => handleImage(event.target.files?.[0])} />
              </label>
              {sourceImage && <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-400"><span className="truncate">{sourceName}</span><button type="button" onClick={() => { setSourceImage(""); setSourceName(""); setResultImage(""); }} className="shrink-0 text-red-300 hover:text-red-200">Rasmni olib tashlash</button></div>}
            </div>

            {mode === "interior" && <div className="mt-5"><label className="text-sm font-bold" htmlFor="room-type">2. Xona turini tanlang</label><select id="room-type" value={room} onChange={(event) => setRoom(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#1b1b24] px-4 py-3 text-sm text-white outline-none focus:border-violet-400">{roomTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>}

            <div className="mt-5">
              <h2 className="text-sm font-bold">{mode === "interior" ? "3" : "2"}. Dizayn uslubini tanlang</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {styles.map((item) => <button key={item.name} type="button" onClick={() => setStyle(item.name)} aria-pressed={style === item.name} className={`group overflow-hidden rounded-2xl border text-left transition ${style === item.name ? "border-violet-500 ring-2 ring-violet-500/50" : "border-white/10 hover:border-white/30"}`}>
                  <div className="relative aspect-[1.55] overflow-hidden bg-[#25252d]"><img src={item.image} alt={item.name + " namunasi"} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />{style === item.name && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-black">✓</span>}</div>
                  <div className={`p-2.5 ${style === item.name ? "bg-violet-950/70" : "bg-[#202027]"}`}><p className="text-xs font-bold sm:text-sm">{item.name}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-400">{item.description}</p></div>
                </button>)}
              </div>
            </div>

            <div className="mt-5">
              <h2 className="text-sm font-bold">{mode === "interior" ? "4" : "3"}. Budjet darajasi</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {budgets.map((item) => <button key={item.name} type="button" onClick={() => setBudget(item.name)} className={`rounded-xl border px-2 py-3 text-center transition ${budget === item.name ? "border-violet-500 bg-violet-600/20 text-white" : "border-white/10 bg-[#202027] text-gray-300 hover:border-white/30"}`}><span className="block text-xs font-bold">{item.name}</span><span className="mt-1 hidden text-[10px] text-gray-500 sm:block">{item.hint}</span></button>)}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="design-requirements" className="text-sm font-bold">{mode === "interior" ? "5" : "4"}. Qo‘shimcha talablar (ixtiyoriy)</label>
              <textarea id="design-requirements" value={requirements} onChange={(event) => setRequirements(event.target.value)} maxLength={500} rows={3} placeholder="Masalan: och ranglarda, ko‘proq yorug‘lik, divanni saqlab qoling..." className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#1b1b24] p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-violet-400" />
              <p className="mt-1 text-right text-[10px] text-gray-500">{requirements.length}/500</p>
            </div>

            <button type="button" disabled={!sourceImage || loading} onClick={generateDesign} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-4 text-sm font-extrabold text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{loading ? <><span className="animate-spin">◌</span> Dizayn yaratilmoqda...</> : <>✧ AI dizayn yaratish <span className="ml-auto rounded-full bg-black/20 px-3 py-1 text-xs">1 kredit</span></>}</button>
            {error && <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            <p className="mt-3 text-center text-[11px] text-gray-500">Rasm faqat muvaffaqiyatli yaratilganda 1 kredit sarflanadi. Xatolikda kredit qaytariladi.</p>
          </section>

          <section className="min-w-0 rounded-[24px] border border-white/10 bg-[#131319] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-bold">Dizayn natijasi</h2><span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-200">{resultImage ? selectedStyle.name : "Natija shu yerda ko‘rinadi"}</span></div>
            {resultImage ? <><div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c24]">
                {showCompare && sourceImage ? <div className="grid grid-cols-2"><div><div className="bg-black/50 px-3 py-2 text-xs font-bold">Oldin</div><img src={sourceImage} alt="Oldingi ko‘rinish" className="aspect-square w-full object-cover" /></div><div><div className="bg-violet-700 px-3 py-2 text-xs font-bold">Keyin · {selectedStyle.name}</div><img src={resultImage} alt="AI dizayn natijasi" className="aspect-square w-full object-cover" /></div></div> : <img src={resultImage} alt="AI yaratgan interyer yoki eksteryer dizayni" className="max-h-[680px] w-full object-contain" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setShowCompare((value) => !value)} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold hover:bg-white/5">{showCompare ? "Natijani ko‘rish" : "Oldin / Keyin taqqoslash"}</button><a href={resultImage} download="ijod-ai-design.png" className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold hover:bg-violet-500">↓ Yuklab olish</a><button type="button" onClick={() => { setSourceImage(resultImage); setSourceName("AI yaratgan dizayn"); setRequirements(""); setResultImage(""); setShowCompare(false); }} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold hover:bg-white/5">✎ Shu dizaynni qayta tahrirlash</button></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#202027] p-4"><h3 className="text-sm font-bold">Dizayn tafsilotlari</h3><p className="mt-3 text-xs text-gray-300">Uslub: {selectedStyle.name}</p><p className="mt-2 text-xs text-gray-300">Yo‘nalish: {mode === "interior" ? room : "Bino fasadi"}</p><p className="mt-2 text-xs text-gray-300">Budjet: {budget}</p></div><div className="rounded-xl bg-[#202027] p-4"><h3 className="text-sm font-bold">Tavsiyalar</h3><p className="mt-3 text-xs leading-5 text-gray-300">{selectedStyle.description}. Tanlangan budjetga mos material va mebel yechimlarini tanlang. Yakuniy qurilishdan oldin o‘lchamlar va konstruktiv qismlarni mutaxassis bilan tekshiring.</p></div></div>
            </> : <div className="mt-4 flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#1b1b22] px-6 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-500/10 text-4xl text-violet-300">✧</div><h3 className="mt-5 text-lg font-bold">Sizning yangi dizayningiz shu yerda</h3><p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">Rasm yuklang, uslub va budjetni tanlang. AI mavjud makoningizni tanlangan uslubda qayta loyihalashtiradi.</p><div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2 text-left text-xs text-gray-500"><div className="rounded-xl bg-[#24242c] p-3">✓ Asl makon tuzilishini saqlashga intilish</div><div className="rounded-xl bg-[#24242c] p-3">✓ Fotorealistik dizayn</div><div className="rounded-xl bg-[#24242c] p-3">✓ Budjetga mos uslub</div><div className="rounded-xl bg-[#24242c] p-3">✓ Oldin / keyin ko‘rinishi</div></div></div>}
          </section>
        </div>
        <p className="mx-auto mt-5 max-w-4xl text-center text-[11px] leading-5 text-gray-600">AI yaratgan tasvir konseptual vizualizatsiya hisoblanadi. U aniq qurilish chizmasi, o‘lchov yoki muhandislik loyihasi o‘rnini bosmaydi.</p>
      </div>
    </main>
  );
}
