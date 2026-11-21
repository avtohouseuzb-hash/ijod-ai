"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/site-preferences";
import { getEduSubjects } from "@/lib/edu-subjects";
import EduFamilyAccess, { EduStudentGradeContext, EduStudentProfileContext, EduStudentLinksContext, StudentLinks } from "@/components/edu-family-access";
import EduTutorMessage, { type EduTutorMessageData } from "@/components/edu-tutor-message";
import EduTutorLessonBoard from "@/components/edu-tutor-lesson-board";
import EduTutorChemistryVisual from "@/components/edu-tutor-chemistry-visual";
import EduTutorDrawingBoard from "@/components/edu-tutor-drawing-board";

type Section = "home" | "tutor" | "homework" | "library" | "progress" | "planner";

type EduTask = { id: number; subject: string; title: string; meta: string; done: boolean };
type StudyPlan = { id: string; title: string; subject: string; grade: number; starts_at: string; duration_minutes: number; notes: string; completed_at: string | null };

// Tasks are empty until real assignments are loaded for the signed-in student.
const tasks: EduTask[] = [];

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

export default function EduPage() { return <EduFamilyAccess><EduStudentPage /></EduFamilyAccess>; }

function EduStudentPage() {
  const savedStudentGrade = useContext(EduStudentGradeContext);
  const savedStudentProfile = useContext(EduStudentProfileContext);
  const { links: familyLinks, refresh: refreshFamilyLinks } = useContext(EduStudentLinksContext);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSignOutBusy, setProfileSignOutBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const profileName = savedStudentProfile?.displayName?.trim() || "O‘quvchi";
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("uz-UZ");
  const [section, setSection] = useState<Section>("home");
  const [grade, setGrade] = useState(`${savedStudentGrade}-sinf`);
  const [completed, setCompleted] = useState<number[]>([]);
  const [homeworkTask, setHomeworkTask] = useState<number | null>(null);
  const [homeworkImage, setHomeworkImage] = useState("");
  const [homeworkFileName, setHomeworkFileName] = useState("");
  const [homeworkBusy, setHomeworkBusy] = useState(false);
  const [homeworkError, setHomeworkError] = useState("");
  const [homeworkFeedback, setHomeworkFeedback] = useState<Record<number, { status: string; feedback: string; score: number }>>({});
  const [subjectQuery, setSubjectQuery] = useState("");
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planSubject, setPlanSubject] = useState("Matematika");
  const [planDate, setPlanDate] = useState("");
  const [planDuration, setPlanDuration] = useState("30");
  const [planNotes, setPlanNotes] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("Matematika");
  const [textbooks, setTextbooks] = useState<{ id: string; title: string; subject: string; grade: number; part: string | null; edition: string | null; publisher: string | null }[]>([]);
  const [textbookLoading, setTextbookLoading] = useState(false);
  const [textbookError, setTextbookError] = useState("");
  const [textbookRefresh, setTextbookRefresh] = useState(0);
  const subjects = useMemo(() => {
    const colors = ["violet", "sky", "emerald", "lime", "amber", "rose", "fuchsia", "teal"];
    return getEduSubjects(Number(grade.split("-")[0])).map((name, index) => {
      const icon = name === "Fizika" ? "atom"
        : name === "Kimyo" ? "flask"
        : name === "Biologiya" || name === "Botanika" ? "dna"
        : name.toLowerCase().includes("tarix") ? "landmark"
        : name === "Geografiya" ? "globe"
        : name.toLowerCase().includes("til") || name === "Alifbe" ? "languages"
        : name === "Matematika" || name === "Algebra" || name === "Geometriya" ? "calculator"
        : "bookText";
      return {
        name,
        short: name.slice(0, 3).toLocaleUpperCase("uz"),
        detail: "Fan bo‘yicha mavzular, darslar va mashqlar",
        color: colors[index % colors.length],
        icon,
      };
    });
  }, [grade]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<EduTutorMessageData[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [tutorError, setTutorError] = useState("");
  const [tutorImageDataUrl, setTutorImageDataUrl] = useState("");
  const [tutorImageName, setTutorImageName] = useState("");
  const [tutorImageError, setTutorImageError] = useState("");
  const tutorImageInputRef = useRef<HTMLInputElement | null>(null);
  const tutorRequestVersion = useRef(0);
  useEffect(() => {
    if (!profileModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileModalOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileModalOpen]);


  useEffect(() => {
    if (section !== "planner") return;
    if (!planDate) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setPlanDate(now.toISOString().slice(0, 16));
    }
    let cancelled = false;
    async function loadPlans() {
      setPlanLoading(true); setPlanError("");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { if (!cancelled) { setPlanError("O‘quv rejasini ko‘rish uchun hisobingizga kiring."); setPlanLoading(false); } return; }
      const { data, error } = await supabase.from("edu_study_plans").select("*").eq("user_id", user.id).order("starts_at", { ascending: true });
      if (!cancelled) { if (error) setPlanError("Rejalarni yuklashda xatolik: " + error.message); else setStudyPlans((data ?? []) as StudyPlan[]); setPlanLoading(false); }
    }
    loadPlans();
    return () => { cancelled = true; };
  }, [section]);
  const filteredSubjects = useMemo(() => subjects.filter((s) => (s.name + " " + s.detail).toLowerCase().includes(subjectQuery.toLowerCase())), [subjectQuery, subjects]);

  useEffect(() => {
    const availableSubjects = subjects.map((subject) => subject.name);
    if (availableSubjects.length && !availableSubjects.includes(selectedSubject)) setSelectedSubject(availableSubjects[0]);
    if (availableSubjects.length && !availableSubjects.includes(planSubject)) setPlanSubject(availableSubjects[0]);
  }, [grade, subjects, selectedSubject, planSubject]);

  useEffect(() => {
    if (section !== "library") return;
    let cancelled = false;
    async function loadTextbooks() {
      setTextbookLoading(true);
      setTextbookError("");
      const { data, error } = await supabase
        .from("edu_textbooks")
        .select("id,title,subject,grade,part,edition,publisher")
        .eq("grade", Number(grade.split("-")[0]))
        .eq("status", "ready")
        .order("subject")
        .order("title");
      if (cancelled) return;
      if (error) setTextbookError("Darsliklar ro‘yxatini yuklab bo‘lmadi.");
      setTextbooks(data ?? []);
      setTextbookLoading(false);
    }
    void loadTextbooks();
    return () => { cancelled = true; };
  }, [section, grade, textbookRefresh]);

  async function addStudyPlan() {
    if (!planTitle.trim() || !planDate) { setPlanError("Dars nomi va sanasini kiriting."); return; }
    setPlanSaving(true); setPlanError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPlanError("Avval hisobingizga kiring."); setPlanSaving(false); return; }
    const { data, error } = await supabase.from("edu_study_plans").insert({ user_id: user.id, title: planTitle.trim(), subject: planSubject, grade: Number(grade.split("-")[0]), starts_at: new Date(planDate).toISOString(), duration_minutes: Number(planDuration), notes: planNotes.trim() }).select("*").single();
    if (error) setPlanError("Rejani saqlab bo‘lmadi: " + error.message);
    else { setStudyPlans((items) => [...items, data as StudyPlan].sort((a,b) => a.starts_at.localeCompare(b.starts_at))); setPlanTitle(""); setPlanNotes(""); }
    setPlanSaving(false);
  }
  async function toggleStudyPlan(plan: StudyPlan) {
    const completedAt = plan.completed_at ? null : new Date().toISOString();
    const { data, error } = await supabase.from("edu_study_plans").update({ completed_at: completedAt, updated_at: new Date().toISOString() }).eq("id", plan.id).select("*").single();
    if (error) setPlanError("Holatni yangilab bo‘lmadi: " + error.message);
    else setStudyPlans((items) => items.map((item) => item.id === plan.id ? data as StudyPlan : item));
  }
  async function deleteStudyPlan(id: string) {
    const { error } = await supabase.from("edu_study_plans").delete().eq("id", id);
    if (error) setPlanError("Rejani o‘chirib bo‘lmadi: " + error.message);
    else setStudyPlans((items) => items.filter((item) => item.id !== id));
  }

  const title = "IJOD EDU";
  const latestTutorReply = [...messages].reverse().find((message) => message.role === "system");
  async function handleProfileSignOut() {
    setProfileSignOutBusy(true);
    setProfileError("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setProfileError("Hisobdan chiqishda xatolik yuz berdi. Qayta urinib ko‘ring.");
      setProfileSignOutBusy(false);
      return;
    }
    window.location.assign("/login");
  }
  function resetTutorSession() {
    tutorRequestVersion.current += 1;
    setMessages([]);
    setQuestion("");
    setTutorError("");
    setTutorImageDataUrl("");
    setTutorImageName("");
    setTutorImageError("");
    setIsSending(false);
  }
  function changeTutorSubject(nextSubject: string) {
    if (nextSubject === selectedSubject) return;
    resetTutorSession();
    setSelectedSubject(nextSubject);
  }
  function changeGrade(nextGrade: string) {
    if (nextGrade === grade) return;
    resetTutorSession();
    setGrade(nextGrade);
  }
  const toggleTask = (id: number) => setCompleted((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  function handleTutorImageFile(file?: File) {
    setTutorImageError("");
    setTutorImageDataUrl("");
    setTutorImageName("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setTutorImageError("Faqat JPG, PNG yoki WEBP rasmini yuklang.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setTutorImageError("Rasm 3 MB dan kichik bo‘lsin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setTutorImageDataUrl(reader.result);
        setTutorImageName(file.name);
      } else setTutorImageError("Rasmni o‘qib bo‘lmadi.");
    };
    reader.onerror = () => setTutorImageError("Rasmni o‘qib bo‘lmadi.");
    reader.readAsDataURL(file);
  }

  function handleHomeworkFile(file?: File) {
    setHomeworkError(""); setHomeworkImage(""); setHomeworkFileName("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setHomeworkError("Faqat JPG, PNG yoki WEBP rasm yuklang."); return; }
    if (file.size > 8 * 1024 * 1024) { setHomeworkError("Rasm hajmi 8 MB dan oshmasin."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { setHomeworkImage(reader.result); setHomeworkFileName(file.name); } else setHomeworkError("Rasmni o‘qib bo‘lmadi."); };
    reader.onerror = () => setHomeworkError("Rasmni o‘qib bo‘lmadi.");
    reader.readAsDataURL(file);
  }
  async function checkHomework() {
    if (homeworkTask === null || !homeworkImage || homeworkBusy) return;
    setHomeworkBusy(true); setHomeworkError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Tekshiruv uchun hisobingizga kiring.");
      const task = tasks.find((item) => item.id === homeworkTask);
      if (!task) throw new Error("Vazifa topilmadi.");
      const response = await fetch("/api/edu-homework-check", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ taskTitle: task.title, subject: task.subject, grade, imageDataUrl: homeworkImage }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI tekshiruvida xatolik.");
      setHomeworkFeedback((current) => ({ ...current, [task.id]: { status: data.status, feedback: data.feedback, score: data.score } }));
      setCompleted((current) => data.passed ? (current.includes(task.id) ? current : [...current, task.id]) : current.filter((id) => id !== task.id));
    } catch (error) { setHomeworkError(error instanceof Error ? error.message : "Tekshiruvda xatolik."); }
    finally { setHomeworkBusy(false); }
  }

  async function sendQuestion() {
    const imageToSend = tutorImageDataUrl;
    const value = question.trim() || (imageToSend ? "Iltimos, yuklangan rasmni ko‘rib, undagi mavzu yoki topshiriqni sodda tushuntir." : "");
    if ((!value && !imageToSend) || isSending) return;
    setQuestion("");
    setTutorError("");
    setTutorImageError("");
    setTutorImageDataUrl("");
    setTutorImageName("");
    setIsSending(true);
    const requestVersion = ++tutorRequestVersion.current;
    const requestSubject = selectedSubject;
    const requestGrade = grade;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "student", text: value, ...(imageToSend ? { imageDataUrl: imageToSend } : {}) }]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("AI Ustoz bilan suhbatlashish uchun avval hisobingizga kiring.");
      const history = messages.map((item) => ({ role: item.role === "student" ? "user" as const : "assistant" as const, content: item.text }));
      const response = await fetch("/api/school-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ message: value, subject: requestSubject, grade: requestGrade, history, ...(imageToSend ? { imageDataUrl: imageToSend } : {}) }),
      });
      const data = await response.json();
      if (requestVersion !== tutorRequestVersion.current) return;
      if (!response.ok || typeof data.text !== "string") throw new Error(data.error || "Javob olishda xatolik yuz berdi.");
      const assistantMessageId = crypto.randomUUID();
      const chemistryVisual = data.visual && typeof data.visual === "object" ? data.visual : undefined;
      const lessonMessage: EduTutorMessageData = {
        id: assistantMessageId,
        role: "system",
        text: data.text,
        ...(data.board && typeof data.board.title === "string" ? { board: data.board } : {}),
        ...(chemistryVisual ? { visual: chemistryVisual } : {}),
        ...(data.drawing && typeof data.drawing.title === "string" && Array.isArray(data.drawing.strokes) ? { drawing: data.drawing } : {}),
      };
      setMessages((current) => [...current, lessonMessage]);

      if (requestSubject.toLocaleLowerCase("uz-UZ").includes("kimyo")) {
        const videoQuery = typeof data.youtubeQuery === "string"
          ? data.youtubeQuery
          : `${requestGrade} kimyo darsi ${value} mavzusi o‘zbek tilida`;
        void fetch("/api/edu-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ query: videoQuery }),
        }).then(async (videoResponse) => {
          if (!videoResponse.ok) throw new Error("Video qidiruvi ishlamadi.");
          return videoResponse.json();
        }).then((videoData) => {
          if (requestVersion !== tutorRequestVersion.current) return;
          setMessages((current) => current.map((item) => item.id === assistantMessageId
            ? {
                ...item,
                videos: Array.isArray(videoData.videos) ? videoData.videos.slice(0, 1) : [],
                ...(typeof videoData.videoNotice === "string" ? { videoNotice: videoData.videoNotice } : {}),
              }
            : item));
        }).catch((error) => {
          console.error("EDU YouTube search failed:", error);
          setMessages((current) => current.map((item) => item.id === assistantMessageId
            ? { ...item, videoNotice: "Video topilmadi. Hozircha darsni davom ettirishing mumkin." }
            : item));
        });
      }
    } catch (error) {
      if (requestVersion !== tutorRequestVersion.current) return;
      const message = error instanceof Error ? error.message : "Noma’lum xatolik yuz berdi.";
      setTutorError(message);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "system", text: "Javob olinmadi. Xatolikni pastda ko‘rishingiz mumkin." }]);
    } finally {
      if (requestVersion === tutorRequestVersion.current) setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-[#f7f7fc] text-[#202033]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[#eceaf5] bg-white px-5 py-6 lg:flex">
        <Link href="/" className="mb-9 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200">
            <svg aria-hidden="true" viewBox="0 0 48 48" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m24 6 17 7-17 7-17-7 17-7Z" />
              <path d="M14 17.1v5.2M34 17.1v5.2" />
              <path d="M7 22c6-2.5 11.8-1.6 17 2.1 5.2-3.7 11-4.6 17-2.1v15c-6-2.5-11.8-1.6-17 2.1-5.2-3.7-11-4.6-17-2.1V22Z" />
              <path d="M24 24.1v15" />
            </svg>
          </span>
          <span><span className="block text-[17px] font-black tracking-tight">IJOD <span className="text-violet-600">EDU</span></span><span className="block text-[9px] font-bold tracking-[.13em] text-slate-400">AI BILAN O‘RGANING</span></span>
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
        <div className="mt-auto" />
      </aside>

      <main className="min-h-screen min-w-0 max-w-full overflow-x-clip lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex min-h-[60px] w-full min-w-0 items-center justify-between gap-2 border-b border-[#eceaf5] bg-white/95 px-3 py-2 backdrop-blur-xl sm:h-[68px] sm:px-7 sm:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                if (section !== "home") setSection("home");
                else if (window.history.length > 1) window.history.back();
                else window.location.assign("/");
              }}
              aria-label="Orqaga qaytish"
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl px-1.5 text-xs font-bold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:gap-2 sm:px-2.5"
            >
              <Icon name="arrowLeft" className="h-5 w-5" />
              <span className="hidden min-[390px]:inline">Orqaga</span>
            </button>
            <span aria-label="IJOD EDU" role="img" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200/60">
              <svg aria-hidden="true" viewBox="0 0 48 48" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m24 6 17 7-17 7-17-7 17-7Z" />
                <path d="M14 17.1v5.2M34 17.1v5.2" />
                <path d="M7 22c6-2.5 11.8-1.6 17 2.1 5.2-3.7 11-4.6 17-2.1v15c-6-2.5-11.8-1.6-17 2.1-5.2-3.7-11-4.6-17-2.1V22Z" />
                <path d="M24 24.1v15" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">IJOD EDU</p>
              <p className="hidden text-[9px] font-semibold uppercase tracking-[.14em] text-slate-400 sm:block">MAKTAB TA’LIMI</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden items-center gap-3 lg:flex">
              <ThemeToggle />
            </div>
            <button type="button" onClick={() => setSection("planner")} aria-label="O‘quv rejasi" className={"inline-flex h-9 w-9 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-semibold transition sm:h-auto sm:w-auto sm:px-3 sm:py-2 " + (section === "planner" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-700")}>
              <Icon name="calendar" className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">O‘quv rejasi</span>
            </button>
            <select aria-label="Sinfni tanlash" value={grade} onChange={(e) => changeGrade(e.target.value)} className="h-9 min-w-0 max-w-[82px] rounded-xl border border-violet-100 bg-violet-50 px-2 text-[11px] font-bold text-violet-700 outline-none focus:ring-2 focus:ring-violet-200 sm:h-auto sm:px-3 sm:py-2.5 sm:text-xs lg:max-w-none">{Array.from({ length: 11 }, (_, i) => <option key={i + 1} value={i + 1 + "-sinf"}>{i + 1}-sinf</option>)}</select>
            <button
              type="button"
              onClick={() => { setProfileError(""); setProfileModalOpen(true); }}
              aria-label="Profil oynasini ochish"
              aria-haspopup="dialog"
              aria-expanded={profileModalOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-cyan-100 text-xs font-black text-violet-700 ring-1 ring-violet-200 transition hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              {profileInitials || "O"}
            </button>
          </div>
        </header>

        {profileModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileModalOpen(false); }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="edu-profile-title"
              className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white p-6 text-slate-800 shadow-2xl shadow-slate-950/25 sm:p-8"
            >
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-200/70 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-cyan-100/80 blur-3xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">IJOD EDU · AKKAUNT</p>
                    <h2 id="edu-profile-title" className="mt-2 text-2xl font-black tracking-tight">Mening profilim</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(false)}
                    aria-label="Oynani yopish"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-violet-50 to-cyan-50 p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-lg font-black text-white shadow-lg shadow-violet-200">
                    {profileInitials || "O"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{profileName}</p>
                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      {savedStudentProfile?.role === "parent" ? "Ota-ona profili" : "O‘quvchi profili"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Profil turi</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">
                      {savedStudentProfile?.role === "parent" ? "Ota-ona" : "O‘quvchi"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sinf</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">
                      {savedStudentProfile?.role === "parent" ? "—" : grade}
                    </p>
                  </div>
                </div>

                {profileError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{profileError}</p>}

                <button
                  type="button"
                  disabled={profileSignOutBusy}
                  onClick={handleProfileSignOut}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"
                >
                  {profileSignOutBusy ? "Hisobdan chiqilmoqda…" : "Hisobdan chiqish"}
                </button>
              </div>
            </section>
          </div>
        )}

        <div className="mx-auto w-full min-w-0 max-w-[1440px] px-3 py-4 sm:px-7 sm:py-8">
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
              <div className="rounded-2xl border border-[#eceaf5] bg-white p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-500">Haftalik faollik</span><span className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">Yangi</span></div><p className="mt-2 text-2xl font-black">0 <span className="text-xs font-semibold text-slate-400">soat</span></p><p className="mt-3 text-[10px] text-slate-400">Faollik hali qayd etilmagan</p></div>
              <div className="rounded-2xl border border-[#eceaf5] bg-white p-4"><span className="text-[11px] font-semibold text-slate-500">Bajarilgan vazifalar</span><p className="mt-2 text-2xl font-black">{completed.length}<span className="text-slate-300"> ta</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{width:"0%"}} /></div></div>
              <div className="rounded-2xl border border-[#eceaf5] bg-white p-4"><span className="text-[11px] font-semibold text-slate-500">O‘rganilgan fanlar</span><p className="mt-2 text-2xl font-black">0 <span className="text-xs font-semibold text-slate-400">fan</span></p><p className="mt-3 text-[10px] text-slate-400">Fan tanlab dars boshlang</p></div>
            </section>

            <section className="mt-9">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-600">O‘ZINGGA MOS TANLA</p><h2 className="mt-1 text-xl font-black tracking-tight">Qaysi fandan boshlaymiz?</h2><p className="mt-1 text-xs text-slate-500">Fan kartasini tanlab, o‘rganishni boshlashing mumkin.</p></div><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><Icon name="search" className="h-4 w-4 text-slate-400" /><input value={subjectQuery} onChange={(e)=>setSubjectQuery(e.target.value)} placeholder="Fanni qidirish..." className="w-36 bg-transparent text-xs outline-none sm:w-48" /></label></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{filteredSubjects.map((subject)=><button key={subject.name} onClick={()=>{changeTutorSubject(subject.name);setSection("tutor");}} className="group rounded-2xl border border-[#eceaf5] bg-white p-4 text-left transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-100/60"><div className="flex items-start justify-between"><span className={"flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black " + (subject.color==="violet"?"bg-violet-50 text-violet-700":subject.color==="sky"?"bg-sky-50 text-sky-700":subject.color==="emerald"?"bg-emerald-50 text-emerald-700":subject.color==="lime"?"bg-lime-50 text-lime-700":subject.color==="amber"?"bg-amber-50 text-amber-700":subject.color==="rose"?"bg-rose-50 text-rose-700":subject.color==="fuchsia"?"bg-fuchsia-50 text-fuchsia-700":"bg-teal-50 text-teal-700")}><Icon name={subject.icon} className="h-6 w-6" /></span><Icon name="arrowUpRight" className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" /></div><p className="mt-4 text-sm font-extrabold">{subject.name}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{subject.detail}</p><div className="mt-4 flex items-center justify-between text-[10px]"><span className="text-slate-400">O‘zlashtirish</span><span className="font-bold text-slate-600">0%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{width:"0%"}} /></div></button>)}</div>
            </section>

            <section className="mt-9 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
              <div className="rounded-2xl border border-[#eceaf5] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-600">BUGUNGI REJA</p><h2 className="mt-1 text-lg font-black">Kichik qadamlar, katta natija</h2></div><button onClick={()=>setSection("homework")} className="text-[11px] font-bold text-violet-700 hover:underline">Barchasi →</button></div><div className="mt-4 space-y-2">{tasks.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Hozircha sizga vazifa biriktirilmagan. Darslik yoki AI Ustoz orqali o‘rganishni boshlang.</p> : tasks.map((task)=><div key={task.id} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left"><span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs " + (completed.includes(task.id)?"border-emerald-500 bg-emerald-500 text-white":"border-slate-300 text-transparent")}>✓</span><span className="min-w-0 flex-1"><span className={"block text-xs font-bold "+(completed.includes(task.id)?"text-slate-400 line-through":"text-slate-800")}>{task.title}</span><span className="mt-1 block text-[10px] text-slate-400">{task.subject} · {task.meta}</span></span><span className="text-[10px] font-semibold text-slate-400">{completed.includes(task.id)?"AI tasdiqladi":"Tekshirilmagan"}</span></div>)}</div></div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#e9e4ff] via-[#f3efff] to-[#e3f7f8] p-5"><div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/70 blur-2xl" /><div className="relative"><span className="inline-flex rounded-lg bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-violet-700">AI USTOZ TAVSIYASI</span><div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm"><Icon name="spark" className="h-6 w-6" /></div><h3 className="mt-4 max-w-xs text-lg font-black leading-snug">Tushunmagan joyingni so‘rashdan qo‘rqma.</h3><p className="mt-2 max-w-xs text-xs leading-5 text-slate-600">AI Ustoz mavzuni senga mos tezlikda, sodda misollar bilan tushuntirishga yordam beradi.</p><button onClick={()=>setSection("tutor")} className="mt-5 inline-flex items-center rounded-xl bg-[#25203f] px-4 py-3 text-[11px] font-bold text-white transition hover:bg-violet-700">Ustoz bilan suhbatlashish <Icon name="arrowUpRight" className="ml-2 h-4 w-4" /></button></div></div>
            </section>
            <StudentLinks links={familyLinks} refresh={refreshFamilyLinks} />
          </>}

          {section === "tutor" && (
            <section className="mx-auto flex w-full min-w-0 max-w-4xl flex-col">
              <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 py-3 sm:py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-cyan-100 text-violet-700">
                    <Icon name="spark" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">AI Ustoz</h1>
                    <p className="truncate text-[10px] text-slate-500 sm:text-xs">{grade} · {selectedSubject}</p>
                  </div>
                </div>
                <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="shrink-0 text-[10px] font-semibold text-slate-500">Fan</span>
                  <select
                    id="tutor-subject"
                    value={selectedSubject}
                    onChange={(e) => changeTutorSubject(e.target.value)}
                    className="min-w-0 max-w-[180px] bg-transparent text-xs font-bold text-slate-800 outline-none sm:max-w-[220px]"
                  >
                    {subjects.map((subject) => <option key={subject.name} value={subject.name}>{subject.name}</option>)}
                  </select>
                </label>
              </header>

              <div className="flex min-h-[min(72vh,760px)] min-w-0 flex-col">
                <div className="min-h-[360px] min-w-0 flex-1 space-y-5 overflow-y-auto py-5 sm:py-7" aria-live="polite">
                  {messages.length === 0 ? (
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                        <Icon name="spark" className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 max-w-[92%]">
                        <p className="text-sm font-bold text-slate-900">Salom! Men sening AI Ustozingman.</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Bugun {selectedSubject.toLocaleLowerCase("uz-UZ")} fanidan nimani o‘rganamiz? Savolingni yoz, birgalikda bosqichma-bosqich tushunamiz.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["Mavzuni sodda tushuntir", "Misol bilan ko‘rsat", "Menga savol berib tekshir"].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setQuestion(value)}
                              className="rounded-full border border-violet-100 bg-white px-3 py-2 text-[10px] font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : messages.map((message) => <EduTutorMessage key={message.id} message={message} />)}
                  {isSending && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><Icon name="spark" className="h-4 w-4" /></span>
                      Ustoz javob tayyorlayapti…
                    </div>
                  )}
                </div>

                                <section className="my-3 w-full min-w-0 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm" aria-label="Interaktiv doska">
                  <div className="flex items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/70 px-3 py-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Icon name="bookText" className="h-4 w-4" /></span>
                      <span className="text-[11px] font-extrabold tracking-wide text-slate-800 sm:text-xs">INTERAKTIV DOSKA</span>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-violet-600">
                      {latestTutorReply?.board || latestTutorReply?.visual || latestTutorReply?.drawing ? "MAVZU TAYYOR" : "MAVZU KUTILMOQDA"}
                    </span>
                  </div>
                  <div className="min-w-0 p-3 sm:p-4">
                    {latestTutorReply?.board ? (
                      <EduTutorLessonBoard board={latestTutorReply.board} visual={latestTutorReply.visual} />
                    ) : latestTutorReply?.visual ? (
                      <EduTutorChemistryVisual visual={latestTutorReply.visual} />
                    ) : latestTutorReply?.drawing ? (
                      <EduTutorDrawingBoard drawing={latestTutorReply.drawing} />
                    ) : (
                      <div className="flex min-h-[100px] flex-col items-center justify-center gap-2 py-5 text-center text-xs text-slate-400">
                        <Icon name="spark" className="h-6 w-6 text-violet-300" />
                        <p>Ustoz mavzuga mos tushuntirish, misol va chizmani shu yerda ko‘rsatadi.</p>
                      </div>
                    )}
                  </div>
                </section>

<div className="sticky bottom-2 z-10 w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_30px_rgba(30,25,60,.08)] sm:p-3">
                  {tutorImageDataUrl && (
                    <div className="mb-3 flex min-w-0 items-center gap-3 rounded-xl bg-cyan-50 p-2.5">
                      <img src={tutorImageDataUrl} alt="Yuklanadigan rasm" className="h-14 w-14 shrink-0 rounded-lg border border-cyan-100 bg-white object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-slate-700">{tutorImageName}</p>
                        <p className="text-[10px] text-slate-500">AI Ustoz rasmni ko‘rib chiqadi</p>
                      </div>
                      <button type="button" onClick={() => { setTutorImageDataUrl(""); setTutorImageName(""); if (tutorImageInputRef.current) tutorImageInputRef.current.value = ""; }} aria-label="Rasmni olib tashlash" className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-white">✕</button>
                    </div>
                  )}
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
                    rows={2}
                    placeholder="Xabar yozing..."
                    className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-1 pt-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700">
                        <Icon name="image" className="h-4 w-4" /> Rasm
                        <input ref={tutorImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => handleTutorImageFile(event.target.files?.[0])} />
                      </label>
                      <span className="hidden text-[9px] text-slate-400 sm:inline">JPG · PNG · WEBP · 3 MB</span>
                    </div>
                    <button
                      type="button"
                      onClick={sendQuestion}
                      disabled={(!question.trim() && !tutorImageDataUrl) || isSending}
                      className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSending ? "Yuborilmoqda…" : "Yuborish"} <Icon name="arrowUpRight" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {tutorImageError && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{tutorImageError}</p>}
                {tutorError && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{tutorError}</p>}
                <p className="py-3 text-center text-[9px] text-slate-400">AI Ustoz javoblari tanlangan fan va sinf darajasiga moslashtiriladi.</p>
              </div>
            </section>
          )}

          <>{section === "homework" && <section className="rounded-3xl border border-[#eceaf5] bg-white p-6 sm:p-8"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-600">TOPSHIRIQLAR MARKAZI</p><h1 className="mt-2 text-2xl font-black">Uy vazifalarim</h1><p className="mt-2 text-sm text-slate-500">Bajargan ishing rasmini yukla. AI tekshiradi va faqat to‘g‘ri bajarilgan vazifani tasdiqlaydi.</p><div className="mt-6 space-y-3">{tasks.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Hozircha uy vazifalari biriktirilmagan.</p> : tasks.map((task) => <div key={task.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-wrap items-center gap-3"><span className={"flex h-8 w-8 items-center justify-center rounded-full border " + (completed.includes(task.id) ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-300")}>{completed.includes(task.id) ? <Icon name="check" className="h-4 w-4" /> : <Icon name="bookText" className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold">{task.title}</p><p className="mt-1 text-xs text-slate-400">{task.subject} · {task.meta}</p></div><span className={"rounded-full px-3 py-1 text-[10px] font-bold " + (completed.includes(task.id) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{completed.includes(task.id) ? "AI tasdiqladi · Bajarildi" : "Tekshirilmagan"}</span></div>{homeworkFeedback[task.id] && <div className="mt-3 rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-900">{homeworkFeedback[task.id].feedback}{homeworkFeedback[task.id].status === "approved" && <p className="mt-1 font-bold">AI bahosi: {homeworkFeedback[task.id].score}/100</p>}</div>}<button onClick={() => { setHomeworkTask(task.id); setHomeworkImage(""); setHomeworkFileName(""); setHomeworkError(""); }} className="mt-3 rounded-xl border border-violet-200 px-3 py-2 text-[11px] font-bold text-violet-700">{completed.includes(task.id) ? "Qayta tekshirtirish" : "Rasm yuklash va AI tekshiruvi"}</button></div>)}</div>{homeworkTask !== null && <div className="mt-6 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-5 text-center"><p className="text-sm font-bold">{tasks.find((task) => task.id === homeworkTask)?.title} — bajarilgan ish rasmi</p><p className="mt-1 text-xs text-slate-500">Topshiriq sharti va yechim to‘liq, tiniq ko‘rinsin. JPG, PNG yoki WEBP · 8 MB gacha.</p><label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-violet-700 shadow-sm"><Icon name="upload" className="h-4 w-4" /> Rasm tanlash<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => handleHomeworkFile(event.target.files?.[0])} /></label>{homeworkImage && <div className="mt-4 flex flex-col items-center gap-2"><img src={homeworkImage} alt="Yuklangan uy vazifasi" className="max-h-56 max-w-full rounded-xl border border-violet-100 object-contain" /><p className="text-xs text-slate-500">{homeworkFileName}</p></div>}{homeworkError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{homeworkError}</p>}<div className="mt-4 flex justify-center gap-2"><button onClick={() => { setHomeworkTask(null); setHomeworkImage(""); setHomeworkError(""); }} disabled={homeworkBusy} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600">Bekor qilish</button><button onClick={checkHomework} disabled={!homeworkImage || homeworkBusy} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{homeworkBusy ? "AI tekshiryapti…" : "AI orqali tekshirish"}</button></div></div>}</section>}</>{section === "library" && <section>
            <div className="rounded-3xl bg-gradient-to-r from-[#eae5ff] to-[#e5f7f7] p-6 sm:p-8">
              <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-700">BILIMLAR KUTUBXONASI</p>
              <h1 className="mt-2 text-2xl font-black">Darsliklar va fanlar katalogi</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{grade} uchun fanlar ro‘yxati. PDF hali yuklanmagan fanlarda AI Ustoz umumiy fan bilimlari asosida tushuntiradi; rasmiy kitob sahifasi yoki mashq raqamini taxmin qilmaydi.</p>
            </div>
            <h2 className="mt-6 text-lg font-black">Fanlar</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{subjects.map(s=><button key={s.name} onClick={()=>{changeTutorSubject(s.name);setSection("tutor");}} className="rounded-2xl border border-[#eceaf5] bg-white p-4 text-left hover:border-violet-200 hover:shadow-lg"><span className="text-violet-600"><Icon name={s.icon} className="h-6 w-6" /></span><p className="mt-3 text-sm font-bold">{s.name}</p><p className="mt-1 text-[10px] text-slate-400">{grade} · AI darsi va mavzular</p></button>)}</div>
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black">Indekslangan rasmiy darsliklar</h2><button onClick={()=>setTextbookRefresh((value)=>value+1)} className="text-xs font-bold text-violet-700">Yangilash</button></div>
              {textbookLoading ? <p className="mt-4 text-sm text-slate-400">Darsliklar tekshirilmoqda…</p> : textbookError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{textbookError}</p> : textbooks.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-violet-200 bg-white p-6"><p className="text-sm font-bold text-slate-700">Bu sinf uchun hozircha PDF darslik indekslanmagan.</p><p className="mt-1 text-xs leading-5 text-slate-500">Fanlar katalogi mavjud. PDF topilgach, administrator uni yuklaydi va AI Ustoz aynan shu kitobga tayana oladi.</p><Link href="/edu/admin/textbooks" className="mt-3 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white">Administrator: darslik yuklash</Link></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{textbooks.map(book=><button key={book.id} onClick={()=>{changeTutorSubject(book.subject);setSection("tutor");setQuestion(book.title+" darsligidagi asosiy mavzularni tushuntirib ber.");}} className="rounded-2xl border border-[#eceaf5] bg-white p-4 text-left hover:border-violet-200 hover:shadow-lg"><p className="text-sm font-bold">{book.title}</p><p className="mt-1 text-xs text-slate-500">{book.grade}-sinf · {book.subject}{book.part ? " · "+book.part : ""}</p>{book.edition && <p className="mt-1 text-[10px] text-slate-400">{book.edition}</p>}{book.publisher && <p className="mt-1 text-[10px] text-slate-400">{book.publisher}</p>}</button>)}</div>}
            </div>
          </section>}

          {section === "planner" && <section className="space-y-5">
            <div className="rounded-3xl bg-gradient-to-r from-[#eae5ff] to-[#e5f7f7] p-6 sm:p-8"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-700">SHAXSIY REJALASHTIRISH</p><h1 className="mt-2 text-2xl font-black">Mening o‘quv rejam</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Darslaringni rejalashtir, bajarilganini belgilab bor. Rejalaring faqat o‘z hisobingda saqlanadi.</p></div>
            <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]"><form onSubmit={(e)=>{e.preventDefault();addStudyPlan();}} className="rounded-3xl border border-[#eceaf5] bg-white p-5 sm:p-6"><h2 className="text-lg font-black">Yangi dars qo‘shish</h2><label className="mt-4 block text-xs font-bold text-slate-600">Dars nomi<input required value={planTitle} onChange={e=>setPlanTitle(e.target.value)} placeholder="Masalan: Chiziqli funksiya" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-300"/></label><label className="mt-3 block text-xs font-bold text-slate-600">Fan<select value={planSubject} onChange={e=>setPlanSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{subjects.map(s=><option key={s.name}>{s.name}</option>)}</select></label><label className="mt-3 block text-xs font-bold text-slate-600">Sana va vaqt<input type="datetime-local" required value={planDate} onChange={e=>setPlanDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label><label className="mt-3 block text-xs font-bold text-slate-600">Davomiyligi<select value={planDuration} onChange={e=>setPlanDuration(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="15">15 daqiqa</option><option value="30">30 daqiqa</option><option value="45">45 daqiqa</option><option value="60">1 soat</option><option value="90">1,5 soat</option><option value="120">2 soat</option></select></label><label className="mt-3 block text-xs font-bold text-slate-600">Izoh (ixtiyoriy)<textarea value={planNotes} onChange={e=>setPlanNotes(e.target.value)} rows={2} placeholder="Nimani o‘rganmoqchisiz?" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-300"/></label>{planError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{planError}</p>}<button disabled={planSaving} className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">{planSaving?"Saqlanmoqda…":"Rejaga qo‘shish"}</button></form>
            <div className="rounded-3xl border border-[#eceaf5] bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">Rejalashtirilgan darslar</h2><p className="mt-1 text-xs text-slate-400">{studyPlans.length} ta reja</p></div><span className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">{studyPlans.filter(p=>p.completed_at).length} ta bajarildi</span></div>{planLoading?<p className="mt-5 text-sm text-slate-400">Rejalar yuklanmoqda…</p>:studyPlans.length===0?<div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><Icon name="calendar" className="mx-auto h-8 w-8 text-violet-400"/><p className="mt-3 text-sm font-bold">Hozircha rejangiz bo‘sh</p><p className="mt-1 text-xs text-slate-500">Chap tomondagi shakl orqali birinchi darsingizni qo‘shing.</p></div>:<div className="mt-5 space-y-3">{studyPlans.map(plan=><article key={plan.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-100 p-4"><button type="button" onClick={()=>toggleStudyPlan(plan)} aria-label={plan.completed_at?"Bajarilgan deb belgilashni bekor qilish":"Bajarildi deb belgilash"} className={"mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border "+(plan.completed_at?"border-emerald-500 bg-emerald-500 text-white":"border-slate-300 text-slate-300")}>{plan.completed_at?<Icon name="check" className="h-4 w-4"/>:""}</button><div className="min-w-0 flex-1"><p className={"text-sm font-bold "+(plan.completed_at?"text-slate-400 line-through":"text-slate-800")}>{plan.title}</p><p className="mt-1 text-xs text-violet-700">{plan.subject} · {plan.grade}-sinf · {plan.duration_minutes} daqiqa</p><p className="mt-1 text-xs text-slate-500">{new Date(plan.starts_at).toLocaleString("uz-UZ",{dateStyle:"medium",timeStyle:"short"})}</p>{plan.notes&&<p className="mt-2 text-xs text-slate-400">{plan.notes}</p>}</div><button type="button" onClick={()=>deleteStudyPlan(plan.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50">O‘chirish</button></article>)}</div>}</div></div>
          </section>}

          {section === "progress" && <section className="rounded-3xl border border-[#eceaf5] bg-white p-6 sm:p-8"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-violet-600">SHAXSIY O‘SISH</p><h1 className="mt-2 text-2xl font-black">Mening natijalarim</h1><p className="mt-2 text-sm text-slate-500">O‘quv jarayoning va fanlar bo‘yicha o‘zlashtirish holati.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{subjects.map(s=><div key={s.name} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold">{s.name}</p><p className="mt-3 text-2xl font-black text-violet-700">0%</p><div className="mt-3 h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{width:"0%"}} /></div></div>)}</div><p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">Hozircha saqlangan o‘quv natijalari yo‘q. Darslar va topshiriqlar bajarilgach, shaxsiy natijalaringiz shu yerda ko‘rsatiladi.</p></section>}

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-6 text-[10px] text-slate-400"><span>© 2026 IJOD EDU · IJOD AI ekotizimi</span><div><span>O‘rganish — bu sayohat.</span></div></footer>
        </div>
      </main>
    </div>
  );
}
