"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Textbook = { id: string; title: string; grade: number; subject: string; status: string; error_message: string | null };
const subjects = ["Matematika", "Fizika", "Kimyo", "Biologiya", "Ingliz tili", "Tarix", "Ona tili", "Geografiya"];

export default function EduTextbookAdminPage() {
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("7");
  const [subject, setSubject] = useState("Matematika");
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<Textbook[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function token() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Avval administrator hisobiga kiring.");
    return session.access_token;
  }
  async function load() {
    try {
      const access = await token();
      const response = await fetch("/api/edu-textbooks", { headers: { Authorization: "Bearer " + access } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ro‘yxat yuklanmadi.");
      setItems(data.textbooks || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Xatolik"); }
  }
  useEffect(() => { void load(); }, []);

  async function upload() {
    if (!file || !title.trim() || busy) return;
    setBusy(true); setMessage("");
    try {
      if (file.type !== "application/pdf" || file.size > 50 * 1024 * 1024) throw new Error("Faqat 50 MB gacha PDF yuklang.");
      const access = await token();
      const init = await fetch("/api/edu-textbooks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + access }, body: JSON.stringify({ title, grade, subject, fileName: file.name }) });
      const data = await init.json();
      if (!init.ok) throw new Error(data.error || "Yuklashni boshlashda xatolik.");
      const { error } = await supabase.storage.from("edu-textbooks").uploadToSignedUrl(data.path, data.token, file, { contentType: "application/pdf", upsert: false });
      if (error) throw new Error("PDF saqlanmadi: " + error.message);
      const indexed = await fetch("/api/edu-textbooks/index", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + access }, body: JSON.stringify({ textbookId: data.textbookId }) });
      const result = await indexed.json();
      if (!indexed.ok) throw new Error(result.error || "Indekslashda xatolik.");
      setMessage("Darslik yuklandi va AI qidiruviga tayyor.");
      setTitle(""); setFile(null);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Noma’lum xatolik"); await load(); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-5xl p-5 sm:p-8">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-widest text-violet-600">IJOD EDU · ADMIN</p><h1 className="mt-2 text-3xl font-black text-slate-900">Maktab darsliklari</h1><p className="mt-2 text-sm text-slate-500">Rasmiy darslik PDF fayllarini yuklang. AI ularni indekslab, tegishli sinf va fan bo‘yicha qidiruvga qo‘shadi.</p></div>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-lg font-bold">Yangi darslik yuklash</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Darslik nomi<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Masalan: Matematika 7-sinf" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" /></label>
        <label className="text-sm font-semibold text-slate-700">Sinf<select value={grade} onChange={e=>setGrade(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm">{Array.from({length:11},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}-sinf</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Fan<select value={subject} onChange={e=>setSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm">{subjects.map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">PDF fayl<input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0] || null)} className="mt-2 block w-full rounded-xl border border-slate-200 p-2 text-xs" /></label>
      </div>
      {file && <p className="mt-3 text-xs text-slate-500">Tanlangan fayl: {file.name} · {(file.size/1024/1024).toFixed(1)} MB</p>}
      <button disabled={!title.trim() || !file || busy} onClick={upload} className="mt-5 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "Yuklanmoqda va indekslanmoqda…" : "Darslikni yuklash"}</button>
      {message && <p role="status" className="mt-4 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">{message}</p>}
    </section>
    <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Yuklangan darsliklar</h2><button onClick={load} className="text-xs font-bold text-violet-700">Yangilash</button></div>
      <div className="mt-4 space-y-2">{items.length ? items.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.grade}-sinf · {item.subject}</p>{item.error_message && <p className="mt-1 text-xs text-rose-600">{item.error_message}</p>}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.status}</span></div>) : <p className="py-8 text-center text-sm text-slate-400">Hali darslik yuklanmagan.</p>}</div>
    </section>
  </main>;
}
