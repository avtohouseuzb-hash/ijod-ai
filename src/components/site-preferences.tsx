"use client";

import { useEffect, useState } from "react";

type Language = "uz" | "ru" | "en";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("ijod-theme");
    const enabled = saved === "dark";
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
    <button type="button" onClick={toggleTheme} aria-label={dark ? "Yorug‘ rejimga o‘tish" : "Tungi rejimga o‘tish"} aria-pressed={dark} title={dark ? "Yorug‘ rejim" : "Tungi rejim"} className={"inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-lg text-slate-700 shadow-sm transition hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 " + className}>
      {dark ? "☀" : "☾"}
    </button>
  );
}

export function LanguageSelect({ className = "" }: { className?: string }) {
  const [language, setLanguage] = useState<Language>("uz");

  useEffect(() => {
    const saved = window.localStorage.getItem("ijod-language");
    if (saved === "uz" || saved === "ru" || saved === "en") {
      setLanguage(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  function changeLanguage(value: string) {
    if (value !== "uz" && value !== "ru" && value !== "en") return;
    setLanguage(value);
    window.localStorage.setItem("ijod-language", value);
    document.documentElement.lang = value;
    window.dispatchEvent(new CustomEvent("ijod-language-change", { detail: value }));
  }

  return (
    <label className={"inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 " + className}>
      <span aria-hidden="true">文</span>
      <select aria-label="Tilni tanlash" value={language} onChange={(event) => changeLanguage(event.target.value)} className="max-w-[105px] bg-transparent text-inherit outline-none">
        <option value="uz">O‘zbekcha</option>
        <option value="ru">Русский</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
