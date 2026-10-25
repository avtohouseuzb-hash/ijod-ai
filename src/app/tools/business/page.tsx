"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const modes = [
  { id: "product", type: "AI Mahsulot sotuvchi", title: "AI Mahsulot sotuvchi", description: "Mahsulot ma’lumotidan marketplace kartasi, SEO tavsifi, afzalliklar, kalit so‘zlar va reklama ssenariysi yarating.", placeholder: "Masalan: ayollar uchun qishki sensorli qo‘lqop, qora rang, telefon ekranida ishlaydi, universal o‘lcham..." },
  { id: "content", type: "AI Kontent-reja", title: "AI Kontent-reja", description: "Brendingiz uchun 7 kunlik kontent reja, post va Reels g‘oyalarini yarating.", placeholder: "Masalan: ayollar kiyim do‘koni, auditoriya 18–35 yosh, Instagram orqali sotuv..." },
  { id: "marketing", type: "AI Marketing maslahatchi", title: "AI Marketing maslahatchi", description: "Mahsulot rasmini tahlil qiling, SEO kalit so‘zlari va reklama rejasini oling; Instagram yoki Uzum do‘konini tahlil qilish uchun havola kiriting.", placeholder: "Mahsulot nomi, narxi, xususiyatlari, auditoriya va maqsadni yozing..." },
  { id: "brand", type: "AI Brend yaratish", title: "AI Brend yaratish", description: "Brend pozitsiyasi, slogan, ranglar palitrasi va Instagram bio ustida ishlang.", placeholder: "Brend nomi, yo‘nalishi, mijozlari va taassurotini yozing..." },
  { id: "document", type: "AI Hujjat yordamchisi", title: "AI Hujjat yordamchisi", description: "Matnni soddalashtirish, qisqartirish, tartibga solish yoki tushuntirish uchun matn va topshiriq kiriting.", placeholder: "Topshiriqni va tahrir qilinadigan matnni shu yerga joylang..." },
  { id: "reels", type: "AI Reels ssenariy paketi", title: "AI Reels ssenariy paketi", description: "15–30 soniyalik Reels uchun hook, kadrlar, ekrandagi yozuv, voiceover va CTA oling.", placeholder: "Mahsulot/xizmat, video maqsadi va kimga mo‘ljallanganini yozing..." },
] as const;

export default function BusinessToolsPage() {
  const [modeId, setModeId] = useState("product");
  const [topic, setTopic] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentDataUrl, setDocumentDataUrl] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [marketingImage, setMarketingImage] = useState<File | null>(null);
  const [marketingImageUrl, setMarketingImageUrl] = useState("");
  const [marketingImageError, setMarketingImageError] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Kiyim va aksessuarlar");
  const [price, setPrice] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [productImageDataUrl, setProductImageDataUrl] = useState("");
  const [productImageError, setProductImageError] = useState("");
  const [tone, setTone] = useState("Professional");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [copied, setCopied] = useState(false);
  const [resultImage, setResultImage] = useState("");
  const [brandLogo, setBrandLogo] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const mode = modes.find((item) => item.id === modeId) ?? modes[0];

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("mode");
    if (next && modes.some((item) => item.id === next)) setModeId(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(Boolean(data.session)); setAuthChecking(false);
      if (data.session) void loadCredits();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session)); setAuthChecking(false);
      if (session) void loadCredits(); else setCredits(null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  async function loadCredits() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from("profiles").select("credits").eq("user_id", session.user.id).maybeSingle();
    if (typeof data?.credits === "number") setCredits(data.credits);
  }

  async function generate() {
    if (loading) return;
    if (modeId === "product" ? (!productName.trim() || !topic.trim()) : modeId === "document" ? (!topic.trim() && !documentDataUrl) : modeId === "marketing" ? (!topic.trim() && !storeUrl.trim() && !instagramHandle.trim() && !marketingImageUrl) : !topic.trim()) return;
    setLoading(true); setError(""); setResult(""); setResultImage(""); setBrandLogo(""); setCopied(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("AI vositasidan foydalanish uchun avval hisobingizga kiring.");
      if (modeId === "product") {
        const response = await fetch("/api/generate-product-card", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ productName: productName.trim(), category, price, details: topic.trim(), tone, imageDataUrl: productImageDataUrl || undefined }),
        });
        const data: { text?: string; image?: string; error?: string; remainingCredits?: number } = await response.json();
        if (!response.ok) throw new Error(data.error || "Mahsulot kartochkasi yaratilmadi.");
        if (!data.text?.trim() || !data.image) throw new Error("AI to‘liq natija qaytarmadi.");
        setResult(data.text); setResultImage(data.image);
        if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
      } else {
        const response = await fetch("/api/generate-text", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ type: mode.type, topic: topic.trim(), tone, ...(modeId === "document" && documentDataUrl ? { fileDataUrl: documentDataUrl, fileName: documentFile?.name, fileMimeType: documentFile?.type || mimeFromName(documentFile?.name || "") } : {}), ...(modeId === "marketing" ? { analysisImageDataUrl: marketingImageUrl || undefined, instagramHandle: instagramHandle.trim(), storeUrl: storeUrl.trim() } : {}) }),
        });
        const data: { text?: string; image?: string; error?: string; remainingCredits?: number } = await response.json();
        if (!response.ok) throw new Error(data.error || "Natija yaratilmadi.");
        if (!data.text?.trim()) throw new Error("AI bo‘sh javob qaytardi. Qayta urinib ko‘ring.");
        setResult(data.text);
        if (modeId === "brand" && data.image) setBrandLogo(data.image);
        if (typeof data.remainingCredits === "number") setCredits(data.remainingCredits);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Xatolik yuz berdi. Qayta urinib ko‘ring."); }
    finally { setLoading(false); }
  }

  function handleMarketingImage(file?: File) {
    setMarketingImageError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMarketingImageError("JPG, PNG yoki WEBP rasm tanlang."); return; }
    if (file.size > 8 * 1024 * 1024) { setMarketingImageError("Rasm hajmi 8 MB dan oshmasin."); return; }
    setMarketingImage(file);
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setMarketingImageUrl(reader.result); };
    reader.onerror = () => setMarketingImageError("Rasmni o‘qib bo‘lmadi.");
    reader.readAsDataURL(file);
  }

  function mimeFromName(name: string) {
    const ext = name.toLowerCase().split(".").pop();
    return ({ pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", doc: "application/msword", xls: "application/vnd.ms-excel", csv: "text/csv", txt: "text/plain" } as Record<string, string>)[ext || ""] || "application/octet-stream";
  }

  function handleDocumentFile(file?: File) {
    setDocumentError("");
    if (!file) return;
    const allowed = [".pdf", ".docx", ".xlsx", ".doc", ".xls", ".csv", ".txt"];
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) { setDocumentError("PDF, Word, Excel, CSV yoki TXT faylini tanlang."); return; }
    if (file.size > 8 * 1024 * 1024) { setDocumentError("Hujjat hajmi 8 MB dan oshmasin."); return; }
    setDocumentFile(file);
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setDocumentDataUrl(reader.result); };
    reader.onerror = () => setDocumentError("Faylni o‘qib bo‘lmadi. Qayta yuklang.");
    reader.readAsDataURL(file);
  }

  async function handleProductImage(file?: File) {
    setProductImageError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setProductImageError("Faqat JPG, PNG yoki WEBP rasm yuklang."); return; }
    if (file.size > 10 * 1024 * 1024) { setProductImageError("Rasm 10 MB dan kichik bo‘lishi kerak."); return; }
    setProductImage(file); setProductImagePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setProductImageDataUrl(reader.result); };
    reader.onerror = () => setProductImageError("Rasmni o‘qib bo‘lmadi. Qayta tanlang.");
    reader.readAsDataURL(file);
  }

  async function downloadBrandLogo() {
    if (!brandLogo) return;
    try {
      const response = await fetch(brandLogo);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "ijod-ai-brand-logo.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch {
      setDownloadError("Logoni yuklab olish bloklandi. Rasmni yangi oynada ochib, bosib turib saqlang.");
    }
  }

  async function downloadProductImage() {
    if (!resultImage) return;
    try {
      const response = await fetch(resultImage); const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = objectUrl; a.download = "ijod-ai-mahsulot-rasmi.png";
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch { setDownloadError("Yuklab olish bloklandi. Rasmni yangi oynada ochib, rasm ustiga bosib turib saqlang."); }
  }

  async function copyResult() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result); setCopied(true); }
    catch { setError("Nusxalash imkoni bo‘lmadi. Matnni belgilab nusxalang."); }
  }

  if (authChecking) return <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] text-sm text-gray-500">Hisobingiz tekshirilmoqda...</main>;
  if (!signedIn) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-4 text-[#191923]">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <div className="text-3xl">✦</div><h1 className="mt-4 text-2xl font-black">IJOD AI Biznes Studio</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">Bu vositalardan foydalanish uchun hisobingizga kiring.</p>
        <Link href="/login" className="mt-6 block rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white">Kirish yoki ro‘yxatdan o‘tish →</Link>
        <Link href="/" className="mt-4 block text-sm font-semibold text-gray-500">← Bosh sahifa</Link>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-4 py-8 text-[#191923] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-violet-700">← Bosh sahifa</Link>
        <header className="mt-6 rounded-3xl bg-gradient-to-br from-[#191326] to-violet-900 p-7 text-white sm:p-9">
          <p className="text-xs font-bold tracking-widest text-violet-200">IJOD AI · BIZNES STUDIO</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{mode.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{mode.description}</p>
          <p className="mt-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">✦ {credits === null ? "Kredit tekshirilmoqda..." : credits + " kredit"}</p>
        </header>
        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
          <label className="block text-sm font-semibold">AI vositasi
            <select value={modeId} onChange={(e) => { setModeId(e.target.value); setResult(""); setError(""); }} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3">
              {modes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          {modeId === "product" && <div className="mt-5 space-y-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 sm:p-5">
            <h2 className="text-lg font-bold">Mahsulot ma’lumotlari</h2>
            <label className="block text-sm font-semibold">Mahsulot nomi *
              <input value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={160} placeholder="Masalan: Ayollar uchun qizil trikotaj jilet" className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal outline-none focus:border-violet-400" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">Kategoriya
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal"><option>Kiyim va aksessuarlar</option><option>Oyoq kiyim</option><option>Bolalar tovarlari</option><option>Uy-ro‘zg‘or buyumlari</option><option>Elektronika</option><option>Go‘zallik va parvarish</option><option>Boshqa</option></select>
              </label>
              <label className="block text-sm font-semibold">Narxi (ixtiyoriy)
                <input value={price} onChange={(e) => setPrice(e.target.value)} maxLength={80} placeholder="Masalan: 129 000 so‘m" className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal outline-none focus:border-violet-400" />
              </label>
            </div>
            <div>
              <div className="text-sm font-semibold">Mahsulot rasmi (ixtiyoriy)</div>
              <p className="mt-1 text-xs leading-5 text-gray-500">Rasmingiz bo‘lsa yuklang. Bo‘lmasa AI yozgan ma’lumotlaringizdan mahsulot tasvirini yaratadi.</p>
              {productImagePreview ? <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3"><img src={productImagePreview} alt="Yuklangan mahsulot" className="max-h-64 w-full rounded-lg object-contain" /><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs text-gray-500">{productImage?.name}</span><button type="button" onClick={() => { setProductImage(null); setProductImagePreview(""); setProductImageDataUrl(""); }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold">Olib tashlash</button></div></div> : <label className="mt-3 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-200 bg-white text-center hover:bg-violet-50"><span className="text-3xl text-violet-600">＋</span><span className="mt-2 text-sm font-bold">Rasm yuklash</span><span className="mt-1 text-xs text-gray-400">JPG, PNG yoki WEBP · 10 MB gacha</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void handleProductImage(e.target.files?.[0])} className="hidden" /></label>}
              {productImageError && <p className="mt-2 text-sm text-red-600">{productImageError}</p>}
            </div>
          </div>}
          {modeId === "marketing" && <div className="mt-5 space-y-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 sm:p-5"><h2 className="text-base font-bold">Tahlil uchun ma’lumotlar</h2><label className="block text-sm font-semibold">Instagram username (ixtiyoriy)<input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value.replace(/^@/, ""))} maxLength={80} placeholder="Masalan: labbay.tech" className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal" /></label><label className="block text-sm font-semibold">Instagram yoki Uzum Market havolasi (ixtiyoriy)<input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} maxLength={500} placeholder="https://www.instagram.com/... yoki Uzum do‘kon havolasi" className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal" /></label><div><div className="text-sm font-semibold">Mahsulot rasmi (ixtiyoriy)</div><p className="mt-1 text-xs leading-5 text-gray-500">Rasm orqali mahsulot ko‘rinishi, auditoriyaga mosligi va reklama uchun g‘oyalar tahlil qilinadi.</p>{marketingImage ? <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3"><img src={marketingImageUrl} alt="Tahlil uchun mahsulot" className="h-20 w-20 rounded-lg object-contain" /><span className="min-w-0 flex-1 truncate text-sm">{marketingImage.name}</span><button type="button" onClick={() => { setMarketingImage(null); setMarketingImageUrl(""); }} className="rounded-lg border px-3 py-2 text-sm">Olib tashlash</button></div> : <label className="mt-3 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-200 bg-white text-center"><span className="text-3xl text-violet-600">＋</span><span className="mt-2 text-sm font-bold">Mahsulot rasmini yuklash</span><span className="mt-1 text-xs text-gray-400">JPG · PNG · WEBP · 8 MB gacha</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleMarketingImage(e.target.files?.[0])} className="hidden" /></label>}{marketingImageError && <p className="mt-2 text-sm text-red-600">{marketingImageError}</p>}</div><p className="text-xs leading-5 text-gray-500">Eslatma: Instagram va marketplace sahifalari ommaviy bo‘lishi kerak. Sayt ma’lumotni bermasa, skrinshot yoki mahsulot rasmlarini yuklang.</p></div>}
          {modeId === "document" && <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 sm:p-5"><div className="text-base font-bold">Hujjat yuklash</div><p className="mt-1 text-sm leading-6 text-gray-500">PDF, Word, Excel, CSV yoki TXT hujjatini tanlang. Hujjatni yuklamasdan ham matnni shu pastdagi maydonga joylashingiz mumkin.</p>{documentFile ? <div className="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">{documentFile.name.split(".").pop()?.toUpperCase()}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{documentFile.name}</div><div className="text-xs text-gray-500">{(documentFile.size / 1024 / 1024).toFixed(2)} MB</div></div><button type="button" onClick={() => { setDocumentFile(null); setDocumentDataUrl(""); setDocumentError(""); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">Olib tashlash</button></div> : <label className="mt-3 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-200 bg-white text-center hover:bg-violet-50"><span className="text-3xl font-light text-violet-600">＋</span><span className="mt-2 text-sm font-bold">Hujjat yuklash</span><span className="mt-1 text-xs text-gray-400">PDF · DOCX · XLSX · DOC · XLS · CSV · TXT</span><span className="mt-1 text-xs text-gray-400">8 MB gacha</span><input type="file" accept=".pdf,.docx,.xlsx,.doc,.xls,.csv,.txt,application/pdf,text/plain,text/csv" onChange={(e) => handleDocumentFile(e.target.files?.[0])} className="hidden" /></label>}{documentError && <p className="mt-2 text-sm text-red-600">{documentError}</p>}</div>}
          <label className="mt-5 block text-sm font-semibold">{modeId === "product" ? "Mahsulot xususiyatlari va ma’lumotlari *" : "Ma’lumot va topshiriq"}
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={7} maxLength={4000} placeholder={modeId === "product" ? "Masalan: paxta va akril aralashmasi, qizil rang, tugmali, 1–3 yosh uchun. Faqat ma’lum xususiyatlarni yozing." : mode.placeholder} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal outline-none focus:border-violet-400" />
            <span className="mt-1 block text-right text-xs font-normal text-gray-400">{topic.length}/4000</span>
          </label>
          <label className="mt-4 block text-sm font-semibold">Uslub
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3"><option>Professional</option><option>Samimiy</option><option>Ijodiy va qiziqarli</option></select>
          </label>
          <button disabled={!(modeId === "product" ? productName.trim() && topic.trim() : modeId === "document" ? (topic.trim() || documentDataUrl) : modeId === "marketing" ? (topic.trim() || storeUrl.trim() || instagramHandle.trim() || marketingImageUrl) : topic.trim()) || loading || Boolean(productImageError) || Boolean(documentError) || Boolean(marketingImageError)} onClick={generate} className="mt-5 w-full rounded-xl bg-violet-600 p-3.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">{loading ? (modeId === "product" ? "Kartochka va rasm tayyorlanmoqda..." : "AI tayyorlayapti...") : modeId === "product" ? "✦ To‘liq kartochka va rasm yaratish (5 kredit)" : modeId === "document" ? "✦ Hujjatni tahlil qilish (1 kredit)" : "✦ Natija yaratish (1 kredit)"}</button>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {result && <section className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{modeId === "product" ? "Tayyor mahsulot kartochkasi" : "Tayyor natija"}</h2><button onClick={copyResult} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700">{copied ? "Nusxalandi ✓" : "Matnni nusxalash"}</button></div>{resultImage && <div className="mt-4 rounded-xl border border-violet-100 bg-white p-3"><h3 className="font-bold">AI mahsulot rasmi</h3><img src={resultImage} alt="AI yaratgan mahsulot tasviri" className="mx-auto mt-3 max-h-[700px] w-full rounded-lg object-contain" /><div className="mt-3 grid gap-2 sm:grid-cols-2"><button onClick={downloadProductImage} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white">⬇ Rasmni yuklab olish</button><a href={resultImage} target="_blank" rel="noreferrer" className="rounded-xl border border-violet-200 px-4 py-3 text-center text-sm font-semibold text-violet-700">Rasmni yangi oynada ochish ↗</a></div>{downloadError && <p className="mt-2 text-sm text-amber-700">{downloadError}</p>}</div>}{brandLogo && <div className="mt-4 rounded-xl border border-violet-100 bg-white p-4"><h3 className="font-bold">AI yaratgan logo</h3><img src={brandLogo} alt="AI yaratgan brend logotipi" className="mx-auto mt-3 max-h-[420px] w-full rounded-lg object-contain" /><div className="mt-3 grid gap-2 sm:grid-cols-2"><button onClick={downloadBrandLogo} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white">⬇ Logoni yuklab olish</button><a href={brandLogo} target="_blank" rel="noreferrer" className="rounded-xl border border-violet-200 px-4 py-3 text-center text-sm font-semibold text-violet-700">Logoni yangi oynada ochish ↗</a></div>{downloadError && <p className="mt-2 text-sm text-amber-700">{downloadError}</p>}</div>}<div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-800">{result}</div></section>}
          <p className="mt-4 text-xs leading-5 text-gray-400">{modeId === "product" ? "To‘liq mahsulot kartochkasi va AI rasmi muvaffaqiyatli yaratilganda 5 kredit ishlatiladi. Xatolik yuz bersa, kredit qaytariladi." : "Har bir muvaffaqiyatli generatsiya 1 kredit ishlatadi. API xatoligida kreditni qaytarishga urinamiz."}</p>
        </section>
      </div>
    </main>
  );
}
