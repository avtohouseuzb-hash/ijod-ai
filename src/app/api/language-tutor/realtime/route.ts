import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const personalities: Record<string, string> = {
  teacher: "Patient, encouraging professional language teacher.",
  friend: "Warm, natural and relaxed conversation partner.",
  strict: "Very direct, demanding coach. Address the learner informally as “sen” in Uzbek, not “siz”. Point out mistakes immediately and firmly. You may use brief, friendly teasing about the mistake itself, but never humiliate, insult, swear at, or mock the learner as a person. Always explain the correction and give a chance to try again.",
  funny: "Playful, light-humoured teacher who uses age-appropriate humour.",
  kind: "Gentle, caring and encouraging teacher. Do not create romantic dependency.",
  mentor: "Professional mentor focused on workplace and career communication.",
};
const moods: Record<string, string> = {
  neutral: "calm and clear",
  kind: "warm, gentle and encouraging",
  happy: "cheerful and energetic, but natural",
  angry: "blunt, strict, informal and energetic. Always use Uzbek informal “sen” forms, never formal “siz”. If the learner makes a mistake, react with a short playful tease about the mistake, then clearly correct it. No profanity, personal insults, humiliation or cruelty.",
  thinking: "thoughtful and analytical",
  sleepy: "calm and measured",
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY Vercel sozlamalarida topilmadi." }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/, "") || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !anon) return NextResponse.json({ error: "Hisobingizga qayta kiring." }, { status: 401 });
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  const language = body.language === "Русский" ? "Russian" : "English";
  const level = ["A1", "A2", "B1", "B2", "C1"].includes(String(body.level)) ? String(body.level) : "A1";
  const personality = personalities[String(body.personality)] || personalities.teacher;
  const mood = moods[String(body.mood)] || moods.neutral;
  const topic = typeof body.topic === "string" ? body.topic.slice(0, 100) : "Everyday conversation";
  const voice = body.voice === "male" ? "ash" : body.voice === "auto" ? "marin" : "coral";
  const beginnerMode = level === "A1";
  const levelPlan: Record<string, string> = {
    A1: "A1: use Uzbek for almost all explanations. Teach one tiny English/Russian phrase at a time, translate immediately, use very common words, one simple question, slow speech and long pauses. Let the learner answer in Uzbek or with one word. Never assume they understand a full foreign-language sentence.",
    A2: "A2: use mostly simple target-language sentences with Uzbek support. Teach everyday phrases, short dialogues, basic present/past/future patterns and 2-3 new words. Speak slowly, repeat or rephrase when needed, and ask one clear question at a time.",
    B1: "B1: conduct most of the conversation in the target language. Use familiar real-life topics, connected sentences, practical vocabulary and short explanations in Uzbek for difficult grammar. Ask follow-up questions and encourage 2-4 sentence answers.",
    B2: "B2: speak naturally at a moderate pace using varied vocabulary, idioms and complex sentence structures. Explain nuanced mistakes in Uzbek when useful. Encourage opinions, reasoning and extended discussion.",
    C1: "C1: use fluent, natural, nuanced target-language conversation at near-native pace. Explore abstract and professional topics, idiomatic expressions, register and subtle grammar. Give concise, advanced feedback in Uzbek when useful."
  };
  const strictTone = mood === "angry" || String(body.personality) === "strict";
  const instructions = [
    "You are IJOD AI, a live conversational language tutor. The learner's support language is Uzbek.",
    levelPlan[level],
    "Personality: " + personality,
    "Tone: " + mood + ".",
    strictTone
      ? "STRICT MODE: address the learner informally as “sen” in Uzbek. Never use “siz” or formal honorifics. Be blunt and demanding, point out errors directly, and you may make a brief light joke about the mistake, then teach the correct form. Never use profanity, attack the learner's intelligence, shame, or humiliate them."
      : "Use polite, friendly Uzbek address (“siz”) in explanations.",
    "Lesson topic: " + topic + ".",
    level === "A1"
      ? "Start with a simple Uzbek greeting and one tiny target-language phrase with its Uzbek meaning. Ask an easy question in Uzbek."
      : "Start with a natural greeting in the target language, calibrated to " + level + ", then ask one level-appropriate question.",
    "Run the lesson as a real teaching conversation: explain briefly, model one example, ask the learner to try, wait for the answer, correct it at the selected level, then build on it. Do not lecture for long.",
    "Finish every spoken answer completely. Use short, natural turns and pause for the learner rather than delivering a long monologue.",
    "Correct meaningful grammar and vocabulary mistakes. In strict mode use a short playful quip about the error, then give the correct version and a chance to retry.",
    "Never read emojis, markdown symbols, or punctuation names aloud. Keep roleplay age-appropriate, respectful and non-manipulative."
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: "gpt-realtime-2.1-mini",
          instructions,
          output_modalities: ["audio"],
          audio: {
            input: {
              noise_reduction: { type: "near_field" },
              transcription: { model: "gpt-4o-mini-transcribe" },
              turn_detection: { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: false }
            },
            output: { voice, speed: 1.0 }
          },
          max_output_tokens: 1200
        }
      }),
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Realtime client secret error:", response.status, data);
      return NextResponse.json({ error: "OpenAI jonli ovoz sessiyasini yaratolmadi. API billing va Realtime model ruxsatini tekshiring." }, { status: 502 });
    }
    if (typeof data.value !== "string") return NextResponse.json({ error: "OpenAI vaqtinchalik kalit qaytarmadi." }, { status: 502 });
    return NextResponse.json({ value: data.value, expires_at: data.expires_at });
  } catch (error) {
    console.error("Realtime session error:", error);
    return NextResponse.json({ error: "Jonli ovoz xizmatiga ulanib bo‘lmadi." }, { status: 502 });
  }
}
