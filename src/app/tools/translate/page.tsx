"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const languages = ["O‘zbekcha", "Inglizcha", "Ruscha", "Turkcha", "Qozoqcha", "Qirg‘izcha", "Tojikcha", "Qoraqalpoqcha", "Turkmancha", "Koreyscha", "Yaponcha", "Xitoycha (soddalashtirilgan)", "Xitoycha (an’anaviy)", "Nemischa", "Fransuzcha", "Ispancha", "Italyancha", "Portugalcha", "Arabcha", "Hindcha", "Urducha", "Forscha", "Indonezcha", "Malaycha", "Ukraincha", "Polyakcha", "Gollandcha", "Yunoncha", "Ibroniycha", "Bengalcha", "Tailandcha", "Vetnamcha", "Shvedcha", "Norvegcha", "Daniyacha"];

export default function TranslateToolPage() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("Avtomatik aniqlash");
  const [targetLanguage, setTargetLanguage] = useState("O‘zbekcha");
  const [translatedText, setTranslatedText] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [lightboxImage, setLightboxImage] = useState("");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSignedIn(Boolean(session));
      setChecking(false);
      if (session) {
        const { data } = await supabase.from("profiles").select("credits").eq("user_id", session.user.id).maybeSingle();
        if (mounted && typeof data?.credits === "number") setCredits(data.credits);
      }
    }
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function translate() {
    if ((!text.trim() && !image) || loading) return;
    setLoading(true); setError(""); setTranslatedText(""); setGeneratedImage(""); setCopied(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSignedIn(false); throw new Error("Davom etish uchun avval hisobingizga kiring."); }
      let imageDataUrl: string | undefined;
      if (image) {
        let bitmap: ImageBitmap;
        try {
          bitmap = await createImageBitmap(image);
        } catch {
          throw new Error("Bu rasm formati brauzerda ochilmadi. Iltimos, rasmni JPG yoki PNG qilib saqlab qayta yuklang.");
        }
        try {
          const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(bitmap.width * scale));
          canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Rasmni qayta ishlash imkoni bo‘lmadi.");
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          let blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Rasmni siqib bo‘lmadi.")), "image/jpeg", 0.8));
          if (blob.size > 1400000) blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Rasmni siqib bo‘lmadi.")), "image/jpeg", 0.58));
          if (blob.size > 2000000) throw new Error("Rasm juda katta. Iltimos, kichikroq surat yuklang.");
          imageDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Rasmni o‘qib bo‘lmadi."));
            reader.onerror = () => reject(new Error("Rasmni o‘qib bo‘lmadi."));
            reader.readAsDataURL(blob);
          });
        } finally { bitmap.close(); }
      }
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ text: text.trim(), sourceLanguage, targetLanguage, imageDataUrl }),
      });
      const data: { translatedText?: string; generatedImage?: string; error?: string; remainingCredits?: number } = await response.json();
      if (!response.ok) throw new Error(data.error || "Tarjima bajarilmadi.");
      if (!data.translatedText) throw new Error("Tarjima natijasi bo‘sh qaytdi.");
      setTranslatedText(data.translatedText);
      if (data.generatedImage) setGeneratedImage(data.generatedImage);
      if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ulanishda xatolik. Qayta urinib ko‘ring.");
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from("profiles").select("credits").eq("user_id", session.user.id).maybeSingle();
        if (typeof data?.credits === "number") setCredits(data.credits);
      }
    } finally { setLoading(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(translatedText); setCopied(true); }
    catch { setError("Nusxalash imkoni bo‘lmadi. Matnni qo‘lda nusxalang."); }
  }

  if (checking) return <main className="min-h-screen grid place-items-center bg-[#f7f7fb]">Hisobingiz tekshirilmoqda...</main>;
  if (!signedIn) return <main className="min-h-screen grid place-items-center bg-[#f7f7fb] p-5"><section className="max-w-md rounded-3xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-black">IJOD AI Tarjima</h1><p className="mt-3 text-sm text-gray-500">Tarjimadan foydalanish uchun hisobingizga kiring.</p><Link className="mt-6 block rounded-xl bg-violet-600 p-3 font-bold text-white" href="/login">Kirish yoki ro‘yxatdan o‘tish →</Link><Link className="mt-4 block text-sm text-violet-700" href="/">← Bosh sahifa</Link></section></main>;

  return <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8">
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="text-sm font-semibold text-violet-700">← Bosh sahifa</Link>
      <header className="mt-6 rounded-3xl bg-gradient-to-br from-[#191326] to-violet-900 p-8 text-white">
        <p className="text-xs font-bold tracking-widest text-violet-200">IJOD LABORATORIYASI</p>
        <h1 className="mt-3 text-3xl font-black">AI Tarjima</h1>
        <p className="mt-3 text-sm text-white/75">Matnni tarjima qiling yoki rasm ichidagi yozuvlarni tarjima qilingan yangi rasmga aylantiring.</p>
        <p className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">✦ {credits === null ? "Kredit tekshirilmoqda..." : `${credits} kredit`}</p>
      </header>
      <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
        <label className="block text-sm font-semibold">Asl til
          <select value={sourceLanguage} onChange={e => setSourceLanguage(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3">
            <option>Avtomatik aniqlash</option>{languages.map(language => <option key={language}>{language}</option>)}
          </select>
        </label>
        <label className="mt-5 block text-sm font-semibold">Qaysi tilga tarjima qilinsin?
          <select value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3">
            {languages.map(language => <option key={language}>{language}</option>)}
          </select>
        </label>
        <label className="mt-5 block text-sm font-semibold">Tarjima qilinadigan matn
          <textarea value={text} onChange={e => setText(e.target.value)} rows={7} maxLength={8000} placeholder="Matnni yozing yoki rasm yuklab, matnni tarjima qildiring..." className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal outline-none focus:border-violet-400" />
          <span className="mt-1 block text-right text-xs font-normal text-gray-400">{text.length}/8000</span>
        </label>
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
            <span className="text-2xl">🖼️</span>
            <span className="text-sm font-semibold">{image ? "Boshqa rasm tanlash" : "Rasmdan tarjima qilish"}</span>
            <span className="text-xs font-normal text-gray-500">Skrinshot va ko‘p uchraydigan rasm formatlari · JPG, PNG, WEBP, GIF, BMP, AVIF va boshqalar · 8 MB gacha</span>
            <input type="file" accept="image/*,.jfif,.pjpeg,.pjp,.tif,.tiff,.avif,.bmp,.gif" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!file.type.startsWith("image/") && !/\.(jfif|pjpeg|pjp|tif|tiff|avif|bmp|gif)$/i.test(file.name)) { setError("Rasm faylini tanlang."); e.currentTarget.value = ""; return; }
              if (file.size > 8 * 1024 * 1024) { setError("Rasm 8 MB dan kichik bo‘lishi kerak."); e.currentTarget.value = ""; return; }
              setImage(file); setImagePreview(URL.createObjectURL(file)); setError(""); setTranslatedText(""); setGeneratedImage("");
            }} />
          </label>
          {imagePreview && <div className="mt-3"><button type="button" onClick={() => { setLightboxImage(imagePreview); setZoom(1); }} className="block w-full cursor-zoom-in" aria-label="Yuklangan rasmni kattalashtirib ko‘rish"><img src={imagePreview} alt="Tarjima uchun yuklangan rasm — kattalashtirish uchun bosing" className="mx-auto max-h-64 rounded-lg object-contain" /></button><p className="mt-1 text-center text-xs text-gray-500">Rasmni kattalashtirib ko‘rish uchun ustiga bosing</p><button type="button" onClick={() => { setImage(null); setImagePreview(""); }} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">Rasmni olib tashlash</button></div>}
        </div>
        <button disabled={(!text.trim() && !image) || loading} onClick={translate} className="mt-5 w-full rounded-xl bg-violet-600 p-3.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Tarjima qilinmoqda..." : "🌐 Tarjima qilish — 1 kredit"}</button>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {translatedText && <section className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Tarjima natijasi</h2>{!generatedImage && <button onClick={copy} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700">{copied ? "Nusxalandi ✓" : "Nusxalash"}</button>}</div>
          {generatedImage ? <div className="mt-4"><button type="button" onClick={() => { setLightboxImage(generatedImage); setZoom(1); }} className="block w-full cursor-zoom-in" aria-label="Natija rasmini kattalashtirib ko‘rish"><img src={generatedImage} alt="Tarjima qilingan rasm — kattalashtirish uchun bosing" className="mx-auto max-h-[640px] w-full rounded-xl object-contain" /></button><p className="mt-1 text-center text-xs text-gray-500">Rasmni ochish va yaqinlashtirish uchun ustiga bosing</p><a href={generatedImage} download="ijod-ai-translated-image.png" className="mt-4 block rounded-xl bg-violet-600 p-3 text-center text-sm font-bold text-white">Rasmni yuklab olish</a></div> : <div className="mt-4 whitespace-pre-wrap text-sm leading-7">{translatedText}</div>}
        </section>}
        <p className="mt-4 text-xs leading-5 text-gray-400">Har bir muvaffaqiyatli tarjima 1 kredit ishlatadi. Server xatosi yuz bersa, kreditni qaytarishga harakat qilamiz.</p>
      {lightboxImage && <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Rasmni kattalashtirib ko‘rish">
        <div className="flex shrink-0 items-center justify-between gap-2 pb-3 text-white">
          <span className="text-sm font-semibold">Rasmni ko‘rish</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setZoom(value => Math.max(0.5, Math.round((value - 0.25) * 100) / 100))} className="rounded-lg bg-white/15 px-3 py-2" aria-label="Kichraytirish">−</button>
            <button type="button" onClick={() => setZoom(1)} className="min-w-16 rounded-lg bg-white/15 px-3 py-2 text-sm">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom(value => Math.min(4, Math.round((value + 0.25) * 100) / 100))} className="rounded-lg bg-white/15 px-3 py-2" aria-label="Kattalashtirish">+</button>
            <button type="button" onClick={() => { setLightboxImage(""); setZoom(1); }} className="ml-1 rounded-lg bg-white/20 px-3 py-2" aria-label="Yopish">✕</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl text-center" onClick={e => { if (e.target === e.currentTarget) { setLightboxImage(""); setZoom(1); } }}>
          <img src={lightboxImage} alt="Kattalashtirilgan rasm" onWheel={e => { if (e.deltaY < 0) setZoom(value => Math.min(4, value + 0.1)); else setZoom(value => Math.max(0.5, value - 0.1)); }} style={{ transform: "scale(" + zoom + ")", transformOrigin: "top center", maxWidth: "100%", height: "auto" }} className="mx-auto cursor-zoom-in rounded-md" />
        </div>
        <p className="shrink-0 pt-2 text-center text-xs text-white/70">+ / − tugmalari yoki sichqoncha g‘ildiragi bilan yaqinlashtiring</p>
      </div>}
      </section>
    </div>
  </main>;
}
