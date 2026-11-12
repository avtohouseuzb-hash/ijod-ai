"use client";

import { useEffect } from "react";

type Language = "uz" | "ru" | "en";

const ru: Record<string, string> = {
  "Bosh sahifa":"Главная","Tariflar":"Тарифы","AI vositalar":"AI-инструменты","AI News":"Новости AI","Mening loyihalarim":"Мои проекты","Sevimlilar":"Избранное","IJOD EDU":"IJOD EDU","Ijod qiling":"Творите","Kirish":"Войти","Mehmon":"Гость","Hisob ulanmagan":"Аккаунт не подключён",
  "Sun’iy intellekt — yangi ijod davri":"Искусственный интеллект — новая эра творчества","G‘oyangizni":"Превратите вашу","ijodga":"идею","aylantiring.":"в творчество.","Rasm, video, ovoz va matn yaratish uchun barcha AI vositalari — bitta platformada.":"Все AI-инструменты для создания изображений, видео, голоса и текста — на одной платформе.","Ijodni boshlash":"Начать творить","Qanday ishlaydi?":"Как это работает?","Tasvir":"Изображение","Video":"Видео","Ovoz":"Голос",
  "YANGI · AI LANGUAGE TUTOR":"НОВОЕ · AI-РЕПЕТИТОР ЯЗЫКОВ","AI Ustoz — sizning shaxsiy til o‘qituvchingiz":"AI-Наставник — ваш личный преподаватель языков","Ingliz va rus tilini o‘zingizga mos ohangda o‘rganing: ustoz, do‘st, hazilkash yoki professional mentor bilan suhbatlashing.":"Изучайте английский и русский в удобном для вас формате: общайтесь с наставником, другом или профессиональным ментором.","✓ Qiziqarli suhbat va real mavzular":"✓ Живое общение и реальные темы","✓ Xatolarni tuzatish va o‘zbekcha tushuntirish":"✓ Исправление ошибок и объяснения на узбекском","✓ So‘zlar, grammatika va darajaga mos mashqlar":"✓ Слова, грамматика и упражнения по уровню","✓ A1–C1 darajalar":"✓ Уровни A1–C1","AI Ustozni ochish →":"Открыть AI-Наставника →","AI suhbatchi kayfiyatlari":"Настроение AI-собеседника","Neytral":"Нейтральный","Mehribon":"Дружелюбный","Xursand":"Радостный","Jahli chiqqan":"Сердитый","O‘ylayapti":"Думает","Dam olyapti":"Отдыхает","Suhbat ohangiga qarab AI belgisi ham o‘zgaradi.":"Выражение AI меняется в зависимости от тона беседы",
  "Tasavvuringizni yarating":"Воплотите своё воображение","AI yordamida g‘oyalaringizni hayotga olib keling.":"Воплощайте свои идеи с помощью AI.","Boshlash →":"Начать →","CREATIVE SUPERAPP":"ТВОРЧЕСКАЯ СУПЕРПЛАТФОРМА","AI Rasm":"AI Изображения","AI Ovoz":"AI Голос","AI Matn":"AI Текст","AI Dizayn":"AI Дизайн","AI Tarjima":"AI Перевод","Mashhur":"Популярное","Yangi":"Новое","Biznes":"Бизнес",
  "Vositalarni qidiring...":"Поиск инструментов...","Qidirish...":"Поиск...","Natijalar":"Результаты","Barcha":"Все","Barchasi":"Все","Batafsil":"Подробнее","Ko‘proq":"Ещё","Orqaga":"Назад","Saqlash":"Сохранить","Bekor qilish":"Отмена","Yuborish":"Отправить","Yuklash":"Загрузить","Yuklanmoqda...":"Загрузка...","Tayyor":"Готово","Yangi loyiha":"Новый проект","Kredit":"Кредит","kredit":"кредит","Kreditlar":"Кредиты","Kredit sotib olish":"Купить кредиты","Profil":"Профиль","Sozlamalar":"Настройки","Chiqish":"Выйти","Ro‘yxatdan o‘tish":"Регистрация","Hisobga kirish":"Войти в аккаунт","Boshlash":"Начать","Bepul boshlash":"Начать бесплатно","Barcha huquqlar himoyalangan.":"Все права защищены.","O‘zbekistonda yaratilgan":"Создано в Узбекистане","Qanday yordam bera olaman?":"Чем я могу помочь?","Mavjud emas":"Недоступно","Xatolik yuz berdi":"Произошла ошибка",
  "AI vositalari":"AI-инструменты","O‘zingizga mos tarifni tanlang":"Выберите подходящий тариф","Kreditlarni xarid qiling va ularni AI vositalarida o‘zingizga kerakli natijalarni yaratish uchun ishlating.":"Покупайте кредиты и используйте их для создания нужных результатов с помощью AI-инструментов.","Tarifni tanlash":"Выбрать тариф","Kreditlar qanday sarflanadi?":"Как расходуются кредиты?","SHAXSIY RO‘YXAT":"ЛИЧНЫЙ СПИСОК","Tez-tez ishlatadigan AI vositalaringizni keyinroq tez topish uchun shu yerda saqlash mumkin. Hozircha sevimlilarga qo‘shilgan vosita yo‘q.":"Здесь можно сохранять часто используемые AI-инструменты. Пока избранных инструментов нет."
};

const en: Record<string, string> = {
  "Bosh sahifa":"Home","Tariflar":"Plans","AI vositalar":"AI tools","AI News":"AI News","Mening loyihalarim":"My projects","Sevimlilar":"Favorites","IJOD EDU":"IJOD EDU","Ijod qiling":"Create","Kirish":"Sign in","Mehmon":"Guest","Hisob ulanmagan":"Account not connected",
  "Sun’iy intellekt — yangi ijod davri":"Artificial intelligence — a new era of creativity","G‘oyangizni":"Turn your","ijodga":"idea","aylantiring.":"into creative work.","Rasm, video, ovoz va matn yaratish uchun barcha AI vositalari — bitta platformada.":"All the AI tools for creating images, video, voice and text — in one platform.","Ijodni boshlash":"Start creating","Qanday ishlaydi?":"How it works?","Tasvir":"Image","Video":"Video","Ovoz":"Voice",
  "YANGI · AI LANGUAGE TUTOR":"NEW · AI LANGUAGE TUTOR","AI Ustoz — sizning shaxsiy til o‘qituvchingiz":"AI Tutor — your personal language teacher","Ingliz va rus tilini o‘zingizga mos ohangda o‘rganing: ustoz, do‘st, hazilkash yoki professional mentor bilan suhbatlashing.":"Learn English and Russian your way: talk with a tutor, a friend, or a professional mentor.","✓ Qiziqarli suhbat va real mavzular":"✓ Engaging conversations and real-world topics","✓ Xatolarni tuzatish va o‘zbekcha tushuntirish":"✓ Error correction and explanations in Uzbek","✓ So‘zlar, grammatika va darajaga mos mashqlar":"✓ Vocabulary, grammar and level-based exercises","✓ A1–C1 darajalar":"✓ A1–C1 levels","AI Ustozni ochish →":"Open AI Tutor →","AI suhbatchi kayfiyatlari":"AI companion moods","Neytral":"Neutral","Mehribon":"Friendly","Xursand":"Happy","Jahli chiqqan":"Angry","O‘ylayapti":"Thinking","Dam olyapti":"Resting","Suhbat ohangiga qarab AI belgisi ham o‘zgaradi.":"The AI expression changes with the conversation tone.",
  "Tasavvuringizni yarating":"Bring your imagination to life","AI yordamida g‘oyalaringizni hayotga olib keling.":"Bring your ideas to life with AI.","Boshlash →":"Get started →","CREATIVE SUPERAPP":"CREATIVE SUPERAPP","AI Rasm":"AI Images","AI Ovoz":"AI Voice","AI Matn":"AI Text","AI Dizayn":"AI Design","AI Tarjima":"AI Translation","Mashhur":"Popular","Yangi":"New","Biznes":"Business",
  "Vositalarni qidiring...":"Search tools...","Qidirish...":"Search...","Natijalar":"Results","Barcha":"All","Barchasi":"All","Batafsil":"Learn more","Ko‘proq":"More","Orqaga":"Back","Saqlash":"Save","Bekor qilish":"Cancel","Yuborish":"Send","Yuklash":"Upload","Yuklanmoqda...":"Loading...","Tayyor":"Ready","Yangi loyiha":"New project","Kredit":"Credit","kredit":"credits","Kreditlar":"Credits","Kredit sotib olish":"Buy credits","Profil":"Profile","Sozlamalar":"Settings","Chiqish":"Sign out","Ro‘yxatdan o‘tish":"Sign up","Hisobga kirish":"Sign in","Boshlash":"Get started","Bepul boshlash":"Start for free","Barcha huquqlar himoyalangan.":"All rights reserved.","O‘zbekistonda yaratilgan":"Made in Uzbekistan","Qanday yordam bera olaman?":"How can I help?","Mavjud emas":"Unavailable","Xatolik yuz berdi":"Something went wrong",
  "AI vositalari":"AI tools","O‘zingizga mos tarifni tanlang":"Choose a plan that fits you","Kreditlarni xarid qiling va ularni AI vositalarida o‘zingizga kerakli natijalarni yaratish uchun ishlating.":"Buy credits and use them to create what you need with AI tools.","Tarifni tanlash":"Choose plan","Kreditlar qanday sarflanadi?":"How are credits used?","SHAXSIY RO‘YXAT":"PERSONAL LIST","Tez-tez ishlatadigan AI vositalaringizni keyinroq tez topish uchun shu yerda saqlash mumkin. Hozircha sevimlilarga qo‘shilgan vosita yo‘q.":"Save your frequently used AI tools here for quick access. You have no favorites yet."
};

const translations = { ru, en };

export function LanguageRuntime() {
  useEffect(() => {
    let language = (localStorage.getItem("ijod-language") || "uz") as "uz" | "ru" | "en";
    if (!["uz", "ru", "en"].includes(language)) language = "uz";
    document.documentElement.lang = language;

    const translate = (node: Text) => {
      const original = node.dataset.ijodOriginal ?? (node.dataset.ijodOriginal = node.textContent ?? "");
      const trimmed = original.trim();
      if (!trimmed) return;
      const replacement = language === "uz" ? original : translations[language][trimmed];
      if (replacement !== undefined && node.textContent !== replacement) node.textContent = replacement;
    };

    const scan = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) { translate(root as Text); return; }
      root.childNodes.forEach(scan);
    };

    scan(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "characterData" && record.target.nodeType === Node.TEXT_NODE) translate(record.target as Text);
        record.addedNodes.forEach(scan);
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });

    const onLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<"uz" | "ru" | "en">).detail;
      if (!["uz", "ru", "en"].includes(next)) return;
      language = next;
      document.documentElement.lang = next;
      scan(document.body);
    };
    window.addEventListener("ijod-language-change", onLanguageChange);
    return () => { observer.disconnect(); window.removeEventListener("ijod-language-change", onLanguageChange); };
  }, []);

  return null;
}
