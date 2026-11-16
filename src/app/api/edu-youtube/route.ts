import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type SelectedVideo = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  url: string;
};

const VERIFIED_CHEMISTRY_VIDEOS: Array<{ keywords: string[]; video: SelectedVideo }> = [
  {
    keywords: ["orbital", "orbitallar", "orbital nima", "orbita", "elektron orbital", "orbitallar va elektron konfiguratsiya"],
    video: {
      id: "WyzRTs6kqa0",
      title: "Orbitallar | Kimyo va hayot",
      channelTitle: "Khan Academy O‘zbek",
      thumbnailUrl: "https://i.ytimg.com/vi/WyzRTs6kqa0/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=WyzRTs6kqa0",
    },
  },
  {
    keywords: ["kimyoga kirish", "atomlar birikmalar ionlar"],
    video: {
      id: "_leSmn0fF2M",
      title: "Kimyoga kirish: atomlar, birikmalar va ionlar",
      channelTitle: "Khan Academy O‘zbek",
      thumbnailUrl: "https://i.ytimg.com/vi/_leSmn0fF2M/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=_leSmn0fF2M",
    },
  },
];

function findVerifiedVideo(query: string): SelectedVideo | null {
  const normalized = query.toLocaleLowerCase("uz-UZ");
  const match = VERIFIED_CHEMISTRY_VIDEOS.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword)),
  );
  return match?.video ?? null;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!accessToken) return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) return NextResponse.json({ error: "Supabase sozlamalari topilmadi." }, { status: 500 });

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(accessToken);
  if (error || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 });
  }

  const query = body && typeof body === "object" && typeof (body as { query?: unknown }).query === "string"
    ? (body as { query: string }).query.trim().slice(0, 180)
    : "";
  if (!query) return NextResponse.json({ error: "Video mavzusi ko‘rsatilmagan." }, { status: 400 });

  // Prefer an editor-verified exact match. Never send a student to a YouTube search-results page.
  const verifiedVideo = findVerifiedVideo(query);
  if (verifiedVideo) {
    return NextResponse.json({ videos: [verifiedVideo], source: "verified-curation" });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      videos: [],
      videoNotice: "Bu mavzu uchun hali tekshirilgan video topilmadi. Yangi mos video qo‘shilganda shu yerda ko‘rinadi.",
      source: "no-verified-video",
    });
  }

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "1",
      order: "relevance",
      safeSearch: "strict",
      relevanceLanguage: "uz",
      regionCode: "UZ",
      videoEmbeddable: "true",
      key: apiKey,
    });
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      console.error("YouTube search API failed:", response.status, (await response.text()).slice(0, 400));
      return NextResponse.json({
        videos: [],
        videoNotice: "Hozircha shu mavzu uchun mos video topilmadi.",
        source: "no-video",
      });
    }

    const data = await response.json() as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          channelTitle?: string;
          thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
        };
      }>;
    };
    const first = data.items?.find((item) => Boolean(item.id?.videoId));
    const id = first?.id?.videoId;
    if (!id) {
      return NextResponse.json({
        videos: [],
        videoNotice: "Bu mavzu bo‘yicha hozir mos video topilmadi.",
        source: "no-video",
      });
    }

    const video: SelectedVideo = {
      id,
      title: first?.snippet?.title ?? "Kimyo darsi",
      channelTitle: first?.snippet?.channelTitle ?? "YouTube",
      thumbnailUrl: first?.snippet?.thumbnails?.medium?.url ?? first?.snippet?.thumbnails?.high?.url ?? first?.snippet?.thumbnails?.default?.url ?? "",
      url: "https://www.youtube.com/watch?v=" + id,
    };
    return NextResponse.json({ videos: [video], source: "youtube-api" });
  } catch (error) {
    console.error("YouTube video lookup failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      videos: [],
      videoNotice: "Video xizmati vaqtincha ishlamayapti. Darsni davom ettirishing mumkin.",
      source: "no-video",
    });
  }
}
