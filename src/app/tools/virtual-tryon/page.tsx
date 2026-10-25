"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "product" | "tryon";
type ImageInput = { file: File; preview: string };

export default function VirtualTryOnPage() {
  const [mode, setMode] = useState<Mode>("product");
  const [product, setProduct] = useState<ImageInput | null>(null);
  const [person, setPerson] = useState<ImageInput | null>(null);
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState("1k");
  const [generationMode, setGenerationMode] = useState("balanced");
  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [result, setResult] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

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

  function chooseImage(file: File | undefined, target: "product" | "person") {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Faqat JPG, PNG yoki WEBP rasmlar qabul qilinadi.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Har bir rasm 10 MB dan kichik bo‘lishi kerak.");
      return;
    }
    const next = { file, preview: URL.createObjectURL(file) };
    if (target === "product") setProduct(next); else setPerson(next);
    setError("");
    setResult("");
  }

  async function toDataUrl(file: File): Promise<string> {
    // Compress both photos before sending JSON; Vercel has a request body limit.
    const bitmap = await createImageBitmap(file);
    try {
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Rasmni qayta ishlash imkoni bo‘lmadi.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encode = (quality: number) => new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Rasmni siqib bo‘lmadi.")), "image/jpeg", quality);
      });
      let blob = await encode(0.82);
      if (blob.size > 1500000) blob = await encode(0.68);
      if (blob.size > 2000000) {
        const smaller = document.createElement("canvas");
        const shrink = Math.min(1, 1100 / Math.max(canvas.width, canvas.height));
        smaller.width = Math.max(1, Math.round(canvas.width * shrink));
        smaller.height = Math.max(1, Math.round(canvas.height * shrink));
        const smallerContext = smaller.getContext("2d");
        if (!smallerContext) throw new Error("Rasmni qayta ishlash imkoni bo‘lmadi.");
        smallerContext.drawImage(canvas, 0, 0, smaller.width, smaller.height);
        blob = await new Promise<Blob>((resolve, reject) => {
          smaller.toBlob((value) => value ? resolve(value) : reject(new Error("Rasmni siqib bo‘lmadi.")), "image/jpeg", 0.65);
        });
      }
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Rasmni o‘qib bo‘lmadi."));
        reader.onerror = () => reject(new Error("Rasmni o‘qib bo‘lmadi."));
        reader.readAsDataURL(blob);
      });
    } finally {
      bitmap.close();
    }
  }

  async function downloadResult() {
    if (!result || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      let blob: Blob;
      if (result.startsWith("data:")) {
        const response = await fetch(result);
        blob = await response.blob();
      } else {
        const response = await fetch(result);
        if (!response.ok) throw new Error("Rasmni olish imkoni bo‘lmadi. Yangi oynada ochib saqlab ko‘ring.");
        blob = await response.blob();
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "ijod-ai-virtual-kiyintirish.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch {
      setDownloadError("Avtomatik yuklab olish bloklandi. «Rasmni yangi oynada ochish» tugmasini bosing, keyin rasm ustiga bosib turib «Rasmni yuklab olish»ni tanlang.");
    } finally {
      setDownloading(false);
    }
  }

  async function generate() {
    if (!product || (mode === "tryon" && !person) || loading) return;
    setLoading(true); setError(""); setResult("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Davom etish uchun hisobingizga kiring.");
      const productImage = await toDataUrl(product.file);
      const modelImage = mode === "tryon" && person ? await toDataUrl(person.file) : undefined;
      const response = await fetch("/api/virtual-tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode, productImage, modelImage, prompt, resolution, generationMode, aspectRatio }),
      });
      const responseText = await response.text();
      let data: { image?: string; error?: string; remainingCredits?: number };
      try {
        data = JSON.parse(responseText) as { image?: string; error?: string; remainingCredits?: number };
      } catch {
        if (response.status === 413 || /request entity too large|payload too large/i.test(responseText)) {
          throw new Error("Rasmlar hajmi server limitidan oshib ketdi. Iltimos, rasmlarni kichikroq hajmda qayta yuklang.");
        }
        throw new Error("Serverdan noto‘g‘ri javob keldi (" + response.status + "). Sahifani yangilang va qayta urinib ko‘ring.");
      }
      if (!response.ok) throw new Error(data.error || "Rasm yaratilmadi.");
      if (!data.image) throw new Error("AI bo‘sh natija qaytardi.");
      setResult(data.image);
      if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi. Qayta urinib ko‘ring.");
      void loadCredits();
    } finally {
      setLoading(false);
    }
  }

  if (authChecking) return <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] text-sm text-gray-500">Hisobingiz tekshirilmoqda...</main>;
  if (!signedIn) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 text-[#191923]">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <div className="text-3xl">👗</div><h1 className="mt-4 text-2xl font-black">AI Virtual Kiyintirish</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">Mahsulotni AI modelga kiydirish yoki o‘z suratingizda kiyib ko‘rish uchun hisobingizga kiring.</p>
        <Link href="/login" className="mt-6 block rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white">Kirish yoki ro‘yxatdan o‘tish →</Link>
        <Link href="/" className="mt-4 block text-sm font-semibold text-gray-500">← Bosh sahifa</Link>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-semibold text-violet-700">← Bosh sahifa</Link>
        <header className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#191326] via-violet-950 to-fuchsia-900 p-7 text-white sm:p-10">
          <p className="text-xs font-bold tracking-[.2em] text-violet-200">IJOD AI · IMAGE STUDIO</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-3xl font-black sm:text-4xl">AI Virtual Kiyintirish</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Kiyim, oyoq kiyim va aksessuarlarni AI modelga kiydiring yoki o‘z suratingizda ko‘ring. Marketplace uchun mahsulot suratlarini fotosessiyasiz yarating.</p></div>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold">✦ {credits === null ? "Kredit tekshirilmoqda..." : credits + " kredit"}</span>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
          <h2 className="text-lg font-bold">Ishlash usulini tanlang</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button onClick={() => { setMode("product"); setResult(""); setError(""); }} className={`rounded-2xl border p-4 text-left transition ${mode === "product" ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100" : "border-gray-200 hover:border-violet-200"}`}>
              <span className="text-2xl">🛍️</span><span className="mt-2 block font-bold">AI modelga kiydirish</span><span className="mt-1 block text-sm leading-5 text-gray-500">Faqat mahsulot rasmi kerak. AI yangi model va fon yaratadi.</span>
            </button>
            <button onClick={() => { setMode("tryon"); setResult(""); setError(""); }} className={`rounded-2xl border p-4 text-left transition ${mode === "tryon" ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100" : "border-gray-200 hover:border-violet-200"}`}>
              <span className="text-2xl">🪞</span><span className="mt-2 block font-bold">O‘z suratimda kiyib ko‘rish</span><span className="mt-1 block text-sm leading-5 text-gray-500">Mahsulot va kiyim kiyadigan odam surati kerak.</span>
            </button>
          </div>

          <div className={`mt-6 grid gap-5 ${mode === "tryon" ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
            <ImagePicker title="1. Mahsulot rasmi" description="Kiyim, krossovka, ko‘zoynak, sumka yoki boshqa taqiladigan mahsulot." image={product} onChange={(file) => chooseImage(file, "product")} onClear={() => setProduct(null)} />
            {mode === "tryon" && <ImagePicker title="2. Odam rasmi" description="Imkon qadar to‘liq gavda, tiniq va yaxshi yoritilgan surat tanlang." image={person} onChange={(file) => chooseImage(file, "person")} onClear={() => setPerson(null)} />}
          </div>

          {mode === "product" && <label className="mt-5 block text-sm font-semibold">Natija formati<select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"><option value="3:4">3:4 — marketplace / katalog</option><option value="4:5">4:5 — Instagram post</option><option value="1:1">1:1 — kvadrat</option><option value="9:16">9:16 — Reels / Story</option><option value="4:3">4:3 — gorizontal</option></select></label>}

          <label className="mt-5 block text-sm font-semibold">Qo‘shimcha ko‘rsatma (ixtiyoriy)<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={500} rows={3} placeholder="Masalan: oq studiya foni, tabiiy yorug‘lik, mahsulot rangi va logotipi o‘zgarmasin..." className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal outline-none focus:border-violet-400" /></label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Sifat<select value={resolution} onChange={(e) => setResolution(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"><option value="1k">Standart — 1K</option><option value="2k">Yuqori — 2K</option></select></label>
            <label className="block text-sm font-semibold">Generatsiya usuli<select value={generationMode} onChange={(e) => setGenerationMode(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"><option value="fast">Tez va tejamkor</option><option value="balanced">Muvozanatli</option><option value="quality">Yuqori sifat</option></select></label>
          </div>

          <button disabled={!product || (mode === "tryon" && !person) || loading} onClick={generate} className="mt-6 w-full rounded-xl bg-violet-600 p-3.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "AI rasm tayyorlayapti... (bu 10–60 soniya olishi mumkin)" : "✦ Rasm yaratish (1 kredit)"}</button>
          {loading && <p className="mt-3 text-center text-xs text-gray-500">Rasmlaringiz AI model tomonidan qayta ishlanmoqda. Iltimos, sahifani yopmang.</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {result && <section className="mt-7 rounded-2xl border border-violet-100 bg-violet-50/50 p-5"><h2 className="text-lg font-bold">Natija tayyor</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={downloadResult} disabled={downloading} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{downloading ? "Yuklanmoqda..." : "⬇ Rasmni yuklab olish"}</button><a href={result} target="_blank" rel="noreferrer" className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-center text-sm font-semibold text-violet-700">Rasmni yangi oynada ochish ↗</a></div>{downloadError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-800">{downloadError}</p>}<img src={result} alt="AI Virtual Kiyintirish natijasi" className="mx-auto mt-4 max-h-[900px] w-full rounded-xl object-contain" /><p className="mt-3 text-xs leading-5 text-gray-500">Telefonda yuklangan rasm odatda «Downloads / Yuklamalar» papkasiga tushadi.</p></section>}
          <p className="mt-5 text-xs leading-5 text-gray-400">Kiritilgan suratlar OpenAI API orqali qayta ishlanadi. Yuklashdan oldin suratdan foydalanishga ruxsatingiz borligiga ishonch hosil qiling. Har bir muvaffaqiyatli generatsiya IJOD AI hisobidan 1 kredit ishlatadi; API xatoligida kredit qaytariladi.</p>
        </section>
      </div>
    </main>
  );
}

function ImagePicker({ title, description, image, onChange, onClear }: {
  title: string;
  description: string;
  image: ImageInput | null;
  onChange: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-4">
      <div className="text-sm font-bold">{title}</div><p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      {image ? <div className="mt-3"><img src={image.preview} alt={title} className="max-h-80 w-full rounded-xl object-contain" /><div className="mt-3 flex items-center justify-between gap-2"><span className="truncate text-xs text-gray-500">{image.file.name}</span><button type="button" onClick={onClear} className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold">Olib tashlash</button></div></div> : <label className="mt-3 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl bg-gray-50 text-center transition hover:bg-violet-50"><span className="text-3xl">＋</span><span className="mt-2 text-sm font-semibold">Rasm tanlash yoki yuklash</span><span className="mt-1 text-xs text-gray-400">JPG, PNG, WEBP · 10 MB gacha</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onChange(e.target.files?.[0])} className="hidden" /></label>}
    </div>
  );
}
