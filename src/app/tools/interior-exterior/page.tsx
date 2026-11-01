"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DesignMode = "interior" | "exterior";
type Budget = "Tejamkor" | "O‘rtacha" | "Premium";
type Style = { name: string; description: string; image: string; category: string; guidance: string };

const interiorStyles: Style[] = [
  { name: "Neo Classic", category: "Klassik", description: "Klassik naqshlar, nafis mebel va hashamatli detallar", guidance: "Elegant neoclassical interior, balanced symmetry, wall panel mouldings, refined furniture, crystal chandelier, warm ivory and beige palette, subtle brass accents.", image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=700&q=85" },
  { name: "Classic", category: "Klassik", description: "An’anaviy Yevropa klassikasi va bezakli mebel", guidance: "Traditional European classic interior, ornate mouldings, carved wood furniture, symmetrical layout, rich fabrics and timeless detailing.", image: "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=700&q=85" },
  { name: "Modern Classic", category: "Klassik", description: "Klassik nafislik va zamonaviy qulaylik", guidance: "Modern classic interior combining elegant classical proportions, restrained mouldings, contemporary furniture and refined neutral colors.", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85" },
  { name: "Luxury", category: "Hashamatli", description: "Marmar, premium mebel va oltin rangli detallar", guidance: "High-end luxury interior with premium marble, bespoke furniture, elegant metallic accents, layered lighting and sophisticated rich textures.", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85" },
  { name: "Art Deco", category: "Hashamatli", description: "Geometrik naqshlar, metall va hashamat", guidance: "Art Deco interior, bold geometric patterns, polished brass, sculptural lighting, luxurious velvet and elegant contrast.", image: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=700&q=85" },
  { name: "Modern", category: "Zamonaviy", description: "Zamonaviy shakllar, marmar va uyg‘un yoritish", guidance: "Contemporary modern interior, clean architectural lines, integrated lighting, refined stone and wood finishes, functional designer furniture.", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85" },
  { name: "Contemporary", category: "Zamonaviy", description: "Bugungi trendlar va qulay zamonaviy makon", guidance: "Current contemporary interior design, curated modern furniture, organic forms, layered neutral palette and balanced materials.", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85" },
  { name: "Minimalism", category: "Minimal", description: "Soddalik, och ranglar va ortiqcha buyumlarsiz makon", guidance: "Minimalist interior, uncluttered surfaces, simple geometry, restrained palette, functional furniture and generous negative space.", image: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=700&q=85" },
  { name: "Scandinavian", category: "Minimal", description: "Tabiiy yog‘och, yorug‘lik va qulaylik", guidance: "Scandinavian interior, pale natural wood, soft whites, cozy textiles, daylight and practical understated furniture.", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85" },
  { name: "Japandi", category: "Minimal", description: "Yapon soddaligi va skandinav iliqligi", guidance: "Japandi interior blending Japanese simplicity with Scandinavian warmth, natural oak, calm neutral colors and low-profile furniture.", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700&q=85" },
  { name: "Wabi-Sabi", category: "Minimal", description: "Tabiiy teksturalar va sokin nomukammallik", guidance: "Wabi-sabi interior, organic imperfect textures, limewash plaster, natural stone, muted earth tones and handcrafted objects.", image: "https://atmosfera32.ru/upload/blog/2026-02-24/wabi_1.JPG" },
  { name: "Loft", category: "Zamonaviy", description: "Beton, g‘isht va metall elementlar", guidance: "Industrial loft interior with exposed brick or concrete, black metal details, open-plan feeling and robust contemporary furniture.", image: "https://myroomdesigner.ai/blog/images/industrial-interior-design.png" },
  { name: "Boho", category: "Sharqona", description: "Tabiiy matolar, o‘simliklar va erkin dekor", guidance: "Bohemian interior with layered natural textiles, rattan, indoor plants, artisanal decor and warm earthy colors.", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700&q=85" },
  { name: "Mid-Century Modern", category: "Zamonaviy", description: "Retro mebel, yog‘och va yumaloq shakllar", guidance: "Mid-century modern interior, walnut furniture, tapered legs, sculptural forms, warm retro palette and timeless mid-century lighting.", image: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=700&q=85" },
  { name: "Moroccan", category: "Sharqona", description: "Koshinlar, arkalar va geometrik naqshlar", guidance: "Moroccan-inspired interior with decorative arches, zellige tile accents, carved details, patterned textiles and warm lantern lighting.", image: "https://www.justmorocco.com/cdn/shop/files/35D16B28-49A7-4E62-989C-88C294C86290.png?v=1774370244&width=1946" },
  { name: "Arabic", category: "Sharqona", description: "Sharqona arkalar, nafis chiroqlar va naqshlar", guidance: "Elegant Arabic-inspired interior with graceful arches, mashrabiya screens, ornamental lanterns, rich textiles and warm neutral tones.", image: "https://d3gq2merok8n5r.cloudfront.net/abhinav/design-ideas-thumbnails-1628773921-7vSz1/amj-2025-1744185110-pMHWe/living-1744276479-FMn7z/225-1747999327-XlRBg.jpg" },
  { name: "Uzbek National", category: "Milliy", description: "Suzani, atlas-adras, ganch va o‘ymakor yog‘och", guidance: "Authentic Uzbek national interior design: refined suzani embroidery motifs, atlas and adras textile accents, carved walnut wood, delicate ganch plaster ornament, traditional ceramic details and a tasteful modern Uzbek home atmosphere. Use authentic Central Asian motifs, not generic Arabic decor.", image: "https://idei.club/uploads/posts/2022-03/1647028183_4-idei-club-p-uzbekskii-stil-v-interere-interer-krasivo-12.jpg" },
  { name: "Modern Uzbek", category: "Milliy", description: "Milliy naqshlar va zamonaviy interyer uyg‘unligi", guidance: "Modern Uzbek interior blending contemporary comfort with subtle Uzbek suzani patterns, ikat textiles, carved wood accents and locally inspired craftsmanship.", image: "https://images.stroistyle.com/posts/932557-uzbekskii-interer-12.jpg" },
  { name: "Tashkent Modern", category: "Milliy", description: "Toshkent uylariga mos zamonaviy premium uslub", guidance: "Upscale contemporary Tashkent apartment interior, practical family-friendly layout, premium stone and wood, warm lighting and restrained Central Asian design accents.", image: "https://www.myuzbekistanstay.com/storage/795256/conversions/elegant-ways-to-travel-to-uzbekistan-for-luxury-stays-teaser.webp" },
  { name: "Eastern Courtyard", category: "Milliy", description: "Sharqona hovli ruhi va milliy bezaklar", guidance: "Central Asian courtyard-inspired interior with an airy aivan feeling, carved timber, patterned ceramic accents, natural materials and calm courtyard colors.", image: "https://www.myuzbekistanstay.com/storage/769821/conversions/planning-your-stay-at-a-bukhara-hotel-with-authentic-uzbek-elegance-teaser.webp" },
];

const exteriorStyles: Style[] = [
  { name: "Hi-Tech", category: "Zamonaviy", description: "Shisha, metall va geometrik fasad", guidance: "High-tech contemporary house facade, crisp geometric volumes, glass, metal, clean joints and integrated architectural lighting.", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85" },
  { name: "Neo Classic", category: "Klassik", description: "Simmetriya, ustunlar va klassik bezaklar", guidance: "Neoclassical villa facade with balanced symmetry, elegant columns, refined cornices, stone details and restrained luxury.", image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=85" },
  { name: "Classic Architecture", category: "Klassik", description: "An’anaviy klassik fasad va ustunlar", guidance: "Traditional European classical architecture, symmetrical facade, elegant columns, pediments, mouldings and timeless stonework.", image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=85" },
  { name: "Modern Classic", category: "Klassik", description: "Klassik proporsiyalar va zamonaviy materiallar", guidance: "Modern classic residential facade, classical proportions with clean modern detailing, premium stone, warm neutral palette and elegant entrance.", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85" },
  { name: "Minimalist", category: "Minimal", description: "Toza chiziqlar va sodda arxitektura", guidance: "Minimalist house facade with simple geometric forms, smooth render, limited materials, clean lines and restrained landscaping.", image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=700&q=85" },
  { name: "Mediterranean", category: "Klassik", description: "Tabiiy tosh, iliq ranglar va janubiy kayfiyat", guidance: "Mediterranean villa facade, warm stucco, natural stone, graceful arches, terracotta accents and sun-washed colors.", image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=700&q=85" },
  { name: "Modern Farmhouse", category: "Zamonaviy", description: "Yog‘och, tosh va sokin qishloqona uslub", guidance: "Modern farmhouse facade with white siding or render, natural timber, stone accents, simple gabled roof and welcoming entry.", image: "https://images.unsplash.com/photo-1600047509782-20d39509f26d?w=700&q=85" },
  { name: "Contemporary", category: "Zamonaviy", description: "Yirik oynalar va zamonaviy arxitektura", guidance: "Contemporary villa architecture, bold but balanced volumes, large glazing, refined concrete, timber and stone materials.", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85" },
  { name: "Spanish", category: "Klassik", description: "Terrakota tom, arkalar va tabiiy tosh", guidance: "Spanish Mediterranean house exterior with terracotta roof tiles, stucco walls, arches, wrought iron and warm stone.", image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=700&q=85" },
  { name: "French Provincial", category: "Klassik", description: "Fransuz nafisligi va bog‘ bilan uyg‘un fasad", guidance: "French provincial country house facade, elegant windows, pale stone, balanced rooflines, shutters and graceful garden setting.", image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=85" },
  { name: "Japanese", category: "Minimal", description: "Yog‘och, tabiiy tosh va sokin landshaft", guidance: "Japanese-inspired modern house exterior with restrained geometry, timber screens, natural stone, deep eaves and minimalist garden.", image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=700&q=85" },
  { name: "Uzbek National", category: "Milliy", description: "Ayvon, naqshinkor ustun va milliy koshinlar", guidance: "Authentic Uzbek national house architecture with a traditional aivan veranda, carved wooden columns, refined blue and turquoise ceramic tile accents, subtle ganch ornament and Central Asian courtyard character. Preserve the existing building structure; avoid generic Middle Eastern styling.", image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=85" },
  { name: "Modern Uzbek", category: "Milliy", description: "Zamonaviy fasad va milliy me’moriy detallar", guidance: "Modern Uzbek residential facade combining contemporary proportions and practical materials with subtle traditional Uzbek carved wood, ceramic patterns and courtyard-inspired details.", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85" },
  { name: "Tashkent Modern", category: "Milliy", description: "Toshkent zamonaviy hovli uylari uslubi", guidance: "Upscale modern Tashkent private house exterior, practical privacy from the street, elegant gate and boundary wall, warm stone and wood, clean contemporary lines.", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85" },
  { name: "Eastern Courtyard", category: "Milliy", description: "Sharqona hovli, ayvon va obodonlashtirish", guidance: "Central Asian courtyard house exterior with shaded aivan veranda, carved timber, patterned ceramic details, courtyard garden and authentic regional character.", image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=85" },
];

const roomTypes = ["Mehmonxona", "Yotoqxona", "Oshxona", "Hammom", "Bolalar xonasi", "Ish xonasi", "Koridor", "Boshqa"];

// Xona turiga qarab interyer namunalarining rasmlari almashadi.
const roomPreviewImages: Record<string, string[]> = {
  "Mehmonxona": ["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=700&q=85", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85", "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85", "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=700&q=85"],
  "Yotoqxona": ["https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=700&q=85", "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700&q=85", "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=700&q=85", "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=700&q=85"],
  "Oshxona": ["https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=700&q=85", "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=700&q=85", "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=700&q=85", "https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=700&q=85"],
  "Hammom": ["https://images.unsplash.com/photo-1620626011761-996317b8d101?w=700&q=85", "https://images.unsplash.com/photo-1629079447777-1e605162dc8d?w=700&q=85", "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=700&q=85", "https://images.unsplash.com/photo-1629079447777-1e605162dc8d?w=700&q=85"],
  "Bolalar xonasi": ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=700&q=85", "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700&q=85", "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=700&q=85", "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=700&q=85"],
  "Ish xonasi": ["https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=700&q=85", "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=700&q=85", "https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&q=85", "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=700&q=85"],
  "Koridor": ["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=700&q=85", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85", "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85", "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=700&q=85"],
  "Boshqa": ["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=700&q=85", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85", "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700&q=85", "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=700&q=85"],
};
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
  const [styleCategory, setStyleCategory] = useState("Barchasi");

  const styles = mode === "interior" ? interiorStyles : exteriorStyles;
  const selectedStyle = useMemo(() => styles.find((item) => item.name === style) ?? styles[0], [styles, style]);
  const categories = ["Barchasi", ...Array.from(new Set(styles.map((item) => item.category)))];
  const visibleStyles = styleCategory === "Barchasi" ? styles : styles.filter((item) => item.category === styleCategory);

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
      const prompt = `Transform the uploaded real photo into a photorealistic ${subject} redesign in the ${selectedStyle.name} style. Budget level: ${budget}. Style guidance: ${selectedStyle.guidance}. The selected interior room type is "${room}". The result MUST remain specifically a ${room.toLowerCase()} and must never turn into another room or an exterior/facade. Preserve the original room/building identity, camera viewpoint, perspective, room dimensions, wall positions, windows, doors, structural openings and recognizable architecture. Do not change the number or position of windows and doors. Redesign finishes, colors, lighting, furniture, decor and non-structural details to match the selected style. ${mode === "exterior" ? "Keep the building footprint and structural form recognizable; redesign facade materials, exterior colors, entrance details, garden and outdoor lighting only where appropriate." : "Keep the room layout and structural elements recognizable; redesign furniture, wall finishes, ceiling details, flooring, curtains and lighting."} Budget direction: ${budget === "Tejamkor" ? "cost-conscious, practical finishes and accessible furniture" : budget === "Premium" ? "premium natural materials, bespoke details and high-end furniture" : "balanced mid-range materials and furniture"}. Additional user requirements: ${requirements.trim() || "Use your design judgement and keep the result functional and elegant."}. Output one highly realistic architectural interior/exterior photograph, not a collage, not a drawing, no text, no labels, no watermark.`;
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
    <main className="min-h-screen w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-[#09090d] px-3 py-4 text-white sm:px-6 sm:py-5 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-[1500px]">
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

        <div className="mt-5 grid w-full min-w-0 grid-cols-1 items-start gap-4 sm:gap-5 xl:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
          <section className="w-full min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#131319] p-3 sm:p-6">
            <div className="grid w-full min-w-0 grid-cols-2 rounded-2xl bg-[#202027] p-1">
              <button type="button" onClick={() => { setMode("interior"); setStyle("Neo Classic"); setStyleCategory("Barchasi"); setResultImage(""); }} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === "interior" ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>▣ Interyer dizayn</button>
              <button type="button" onClick={() => { setMode("exterior"); setStyle("Hi-Tech"); setStyleCategory("Barchasi"); setResultImage(""); }} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === "exterior" ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}>▦ Eksteryer dizayn</button>
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
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((category) => <button key={category} type="button" onClick={() => setStyleCategory(category)} className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold transition ${styleCategory === category ? "border-violet-500 bg-violet-600/20 text-violet-100" : "border-white/10 bg-[#202027] text-gray-400 hover:text-white"}`}>{category}</button>)}
              </div>
              <div className="mt-3 flex w-full min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Dizayn uslublari karuseli">
                {visibleStyles.map((item, index) => { const previewImage = item.image; return <button key={mode + "-" + room + "-" + item.name} type="button" onClick={() => setStyle(item.name)} aria-pressed={style === item.name} className={`group w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl border text-left transition sm:w-[46%] lg:w-[42%] ${style === item.name ? "border-violet-500 ring-2 ring-violet-500/50" : "border-white/10 hover:border-white/30"}`}>
                  <div className="relative aspect-[1.55] overflow-hidden bg-[#25252d]"><img src={previewImage} alt={room + " · " + item.name + " dizayn namunasi"} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />{style === item.name && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-black">✓</span>}</div>
                  <div className={`p-2.5 ${style === item.name ? "bg-violet-950/70" : "bg-[#202027]"}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold sm:text-sm">{item.name}</p><span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[9px] text-gray-400">{item.category}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-400">{item.description}</p></div>
                </button>; })}
              </div>
              <p className="mt-1 text-[10px] text-gray-500">{mode === "interior" ? room + " uchun namunalar · yon tomonga suring →" : "Namunalarni yon tomonga surib ko‘ring →"}</p>
            </div>

            <div className="mt-5">
              <h2 className="text-sm font-bold">{mode === "interior" ? "4" : "3"}. Budjet darajasi</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">
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

          <section className="w-full min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#131319] p-3 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-bold">Dizayn natijasi</h2><span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-200">{resultImage ? selectedStyle.name : "Natija shu yerda ko‘rinadi"}</span></div>
            {resultImage ? <><div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c24]">
                {showCompare && sourceImage ? <div className="grid grid-cols-1 min-[520px]:grid-cols-2"><div><div className="bg-black/50 px-3 py-2 text-xs font-bold">Oldin</div><img src={sourceImage} alt="Oldingi ko‘rinish" className="aspect-square w-full object-cover" /></div><div><div className="bg-violet-700 px-3 py-2 text-xs font-bold">Keyin · {selectedStyle.name}</div><img src={resultImage} alt="AI dizayn natijasi" className="aspect-square w-full object-cover" /></div></div> : <img src={resultImage} alt="AI yaratgan interyer yoki eksteryer dizayni" className="max-h-[680px] w-full object-contain" />}
              </div>
              <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap"><button type="button" onClick={() => setShowCompare((value) => !value)} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold hover:bg-white/5">{showCompare ? "Natijani ko‘rish" : "Oldin / Keyin taqqoslash"}</button><a href={resultImage} download="ijod-ai-design.png" className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold hover:bg-violet-500">↓ Yuklab olish</a><button type="button" onClick={() => { setSourceImage(resultImage); setSourceName("AI yaratgan dizayn"); setRequirements(""); setResultImage(""); setShowCompare(false); }} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold hover:bg-white/5">✎ Shu dizaynni qayta tahrirlash</button></div>
              <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#202027] p-4"><h3 className="text-sm font-bold">Dizayn tafsilotlari</h3><p className="mt-3 text-xs text-gray-300">Uslub: {selectedStyle.name}</p><p className="mt-2 text-xs text-gray-300">Yo‘nalish: {mode === "interior" ? room : "Bino fasadi"}</p><p className="mt-2 text-xs text-gray-300">Budjet: {budget}</p></div><div className="rounded-xl bg-[#202027] p-4"><h3 className="text-sm font-bold">Tavsiyalar</h3><p className="mt-3 text-xs leading-5 text-gray-300">{selectedStyle.description}. Tanlangan budjetga mos material va mebel yechimlarini tanlang. Yakuniy qurilishdan oldin o‘lchamlar va konstruktiv qismlarni mutaxassis bilan tekshiring.</p></div></div>
            </> : <div className="mt-4 flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#1b1b22] px-6 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-500/10 text-4xl text-violet-300">✧</div><h3 className="mt-5 text-lg font-bold">Sizning yangi dizayningiz shu yerda</h3><p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">Rasm yuklang, uslub va budjetni tanlang. AI mavjud makoningizni tanlangan uslubda qayta loyihalashtiradi.</p><div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2 text-left text-xs text-gray-500"><div className="rounded-xl bg-[#24242c] p-3">✓ Asl makon tuzilishini saqlashga intilish</div><div className="rounded-xl bg-[#24242c] p-3">✓ Fotorealistik dizayn</div><div className="rounded-xl bg-[#24242c] p-3">✓ Budjetga mos uslub</div><div className="rounded-xl bg-[#24242c] p-3">✓ Oldin / keyin ko‘rinishi</div></div></div>}
          </section>
        </div>
        <p className="mx-auto mt-5 max-w-4xl text-center text-[11px] leading-5 text-gray-600">AI yaratgan tasvir konseptual vizualizatsiya hisoblanadi. U aniq qurilish chizmasi, o‘lchov yoki muhandislik loyihasi o‘rnini bosmaydi.</p>
      </div>
    </main>
  );
}
