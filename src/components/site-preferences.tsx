"use client";

import { useEffect, useState } from "react";

type Language = "uz" | "ru" | "en";
const languageNames: Record<Language, string> = { uz: "O‘zbekcha", ru: "Русский", en: "English" };

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const enabled = window.localStorage.getItem("ijod-theme") === "dark";
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    window.localStorage.setItem("ijod-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Yorug‘ rejimga o‘tish" : "Tungi rejimga o‘tish"}
      aria-pressed={dark}
      title={dark ? "Yorug‘ rejim" : "Tungi rejim"}
      className={"ijod-theme-toggle group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:text-amber-300 " + className}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={"h-[21px] w-[21px] " + (dark ? "ijod-moon-icon" : "ijod-sun-icon")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {dark ? <><path d="M20.2 15.2A8.4 8.4 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" /><path d="m17.5 3 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" /></> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>}
      </svg>
    </button>
  );
}

export function LanguageSelect({ className = "" }: { className?: string }) {
  const [language, setLanguage] = useState<Language>("uz");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("ijod-language");
    if (saved === "uz" || saved === "ru" || saved === "en") {
      setLanguage(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  function changeLanguage(value: Language) {
    setLanguage(value);
    setOpen(false);
    window.localStorage.setItem("ijod-language", value);
    document.documentElement.lang = value;
    window.dispatchEvent(new CustomEvent("ijod-language-change", { detail: value }));
  }

  return (
    <div className={"relative " + className}>
      <button
        type="button"
        aria-label="Tilni tanlash"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-[10px] font-extrabold tracking-wide text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{language.toUpperCase()}</span>
          <span className="hidden truncate sm:inline">{languageNames[language]}</span>
        </span>
        <svg viewBox="0 0 20 20" className={"h-4 w-4 shrink-0 text-slate-400 transition-transform " + (open ? "rotate-180" : "")} fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <>
          <button aria-label="Til menyusini yopish" className="fixed inset-0 z-[90] cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-[100] mt-2 w-max min-w-[176px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
            {(["uz", "ru", "en"] as Language[]).map(option => (
              <button key={option} type="button" onClick={() => changeLanguage(option)} className={"flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition " + (language === option ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800")}>
                {languageNames[option]}
                {language === option && <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 10 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
