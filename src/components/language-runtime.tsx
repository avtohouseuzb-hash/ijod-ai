"use client";

import { useEffect } from "react";

type Language = "uz" | "ru" | "en";

const translations: Record<Exclude<Language, "uz">, Record<string, string>> = {
  ru: {
    "Bosh sahifa":"Главная","Tariflar":"Тарифы","AI vositalar":"AI-инструменты","AI News":"Новости AI","Mening loyihalarim":"Мои проекты","Sevimlilar":"Избранное","IJOD EDU":"IJOD EDU","Ijod qiling":"Творите","Kirish":"Войти","Mehmon":"Гость","Hisob ulanmagan":"Аккаунт не подключён",
    "Sun’iy intellekt — yangi ijod davri":"Искусственный интеллект — новая эра творчества","G‘oyangizni ":"Превратите свою ","ijodga":"идею в творчество"," aylantiring.":"уже сегодня.","Rasm, video, ovoz va matn yaratish uchun barcha AI vositalari — bitta platformada.":"Все AI-инструменты для создания изображений, видео, голоса и текста — на одной платформе.","Ijodni boshlash":"Начать творить","Qanday ishlaydi?":"Как это работает?","Tasvir":"Изображение","Video":"Видео","Ovoz":"Голос",
    "YANGI · AI LANGUAGE TUTOR":"НОВОЕ · AI-РЕПЕТИТОР ЯЗЫКОВ","AI Ustoz — sizning shaxsiy til o‘qituvchingiz":"AI-Наставник — ваш личный преподаватель языков","Ingliz va rus tilini o‘zingizga mos ohangda o‘rganing: ustoz, do‘st, hazilkash yoki professional mentor bilan suhbatlashing.":"Изучайте английский и русский в удобном для вас формате: общайтесь с наставником, другом или профессиональным ментором.","✓ Qiziqarli suhbat va real mavzular":"✓ Живое общение и реальные темы","✓ Xatolarni tuzatish va o‘zbekcha tushuntirish":"✓ Исправление ошибок и объяснения на узбекском","✓ So‘zlar, grammatika va darajaga mos mashqlar":"✓ Слова, грамматика и упражнения по уровню","✓ A1–C1 darajalar":"✓ Уровни A1–C1","AI Ustozni ochish →":"Открыть AI-Наставника →","AI suhbatchi kayfiyatlari":"Настроение AI-собеседника","Neytral":"Нейтральный","Mehribon":"Дружелюбный","Xursand":"Радостный","Jahli chiqqan":"Сердитый","O‘ylayapti":"Думает","Dam olyapti":"Отдыхает","Suhbat ohangiga qarab AI belgisi ham o‘zgaradi.":"Выражение AI меняется в зависимости от тона беседы.",
    "Tasavvuringizni yarating":"Воплотите своё воображение","AI yordamida g‘oyalaringizni hayotga olib keling.":"Воплощайте свои идеи с помощью AI.","Boshlash →":"Начать →","CREATIVE SUPERAPP":"ТВОРЧЕСКИЙ СУПЕРПРИЛОЖЕНИЕ","AI Rasm":"AI Изображения","AI Ovoz":"AI Голос","AI Matn":"AI Текст","AI Dizayn":"AI Дизайн","AI Tarjima":"AI Перевод","Mashhur":"Популярное","Yangi":"Новое","Biznes":"Бизнес"
  },
  en: {
    "Bosh sahifa":"Home","Tariflar":"Plans","AI vositalar":"AI tools","AI News":"AI News","Mening loyihalarim":"My projects","Sevimlilar":"Favorites","IJOD EDU":"IJOD EDU","Ijod qiling":"Create","Kirish":"Sign in","Mehmon":"Guest","Hisob ulanmagan":"Account not connected",
    "Sun’iy intellekt — yangi ijod davri":"Artificial intelligence — a new era of creativity","G‘oyangizni ":"Turn your ","ijodga":"ideas into"," aylantiring.":"creative work.","Rasm, video, ovoz va matn yaratish uchun barcha AI vositalari — bitta platformada.":"All the AI tools for creating images, video, voice and text — in one platform.","Ijodni boshlash":"Start creating","Qanday ishlaydi?":"How it works?","Tasvir":"Image","Video":"Video","Ovoz":"Voice",
    "YANGI · AI LANGUAGE TUTOR":"NEW · AI LANGUAGE TUTOR","AI Ustoz — sizning shaxsiy til o‘qituvchingiz":"AI Tutor — your personal language teacher","Ingliz va rus tilini o‘zingizga mos ohangda o‘rganing: ustoz, do‘st, hazilkash yoki professional mentor bilan suhbatlashing.":"Learn English and Russian your way: talk with a tutor, a friend, or a professional mentor.","✓ Qiziqarli suhbat va real mavzular":"✓ Engaging conversations and real-world topics","✓ Xatolarni tuzatish va o‘zbekcha tushuntirish":"✓ Error correction and explanations in Uzbek","✓ So‘zlar, grammatika va darajaga mos mashqlar":"✓ Vocabulary, grammar and level-based exercises","✓ A1–C1 darajalar":"✓ A1–C1 levels","AI Ustozni ochish →":"Open AI Tutor →","AI suhbatchi kayfiyatlari":"AI companion moods","Neytral":"Neutral","Mehribon":"Friendly","Xursand":"Happy","Jahli chiqqan":"Angry","O‘ylayapti":"Thinking","Dam olyapti":"Resting","Suhbat ohangiga qarab AI belgisi ham o‘zgaradi.":"The AI expression changes with the conversation tone.",
    "Tasavvuringizni yarating":"Bring your imagination to life","AI yordamida g‘oyalaringizni hayotga olib keling.":"Bring your ideas to life with AI.","Boshlash →":"Get started →","CREATIVE SUPERAPP":"CREATIVE SUPERAPP","AI Rasm":"AI Images","AI Ovoz":"AI Voice","AI Matn":"AI Text","AI Dizayn":"AI Design","AI Tarjima":"AI Translation","Mashhur":"Popular","Yangi":"New","Biznes":"Business"
  }
};

function translateNode(node: Text, language: Language) {
  const original = node.textContent ?? "";
  const trimmed = original.trim();
  if (!trimmed) return;
  const replacement = language === "uz" ? trimmed : translations[language][trimmed];
  if (replacement && replacement !== trimmed) {
    const leading = original.match(/^\\s*/)?.[0] ?? "";
    const trailing = original.match(/\\s*$/)?.[0] ?? "";
    node.textContent = leading + replacement + trailing;
  }
}

export function LanguageRuntime() {
  useEffect(() => {
    let language = (localStorage.getItem("ijod-language") || "uz") as Language;
    if (!["uz", "ru", "en"].includes(language)) language = "uz";
    document.documentElement.lang = language;

    const scan = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        translateNode(root as Text, language);
        return;
      }
      root.childNodes.forEach(child => scan(child));
    };

    scan(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "characterData" && record.target.nodeType === Node.TEXT_NODE) {
          translateNode(record.target as Text, language);
        }
        record.addedNodes.forEach(node => scan(node));
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });

    const onLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<Language>).detail;
      if (!["uz", "ru", "en"].includes(next)) return;
      language = next;
      document.documentElement.lang = next;
      scan(document.body);
    };
    window.addEventListener("ijod-language-change", onLanguageChange);
    return () => {
      observer.disconnect();
      window.removeEventListener("ijod-language-change", onLanguageChange);
    };
  }, []);

  return null;
}
