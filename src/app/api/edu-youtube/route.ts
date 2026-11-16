import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "") ?? "";
  if (!accessToken) return NextResponse.json({ error: "Avval hisobingizga kiring." }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) return NextResponse.json({ error: "Supabase sozlamalari topilmadi." }, { status: 500 });

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(accessToken);
  if (error || !user) return NextResponse.json({ error: "Sessiya tugagan. Qayta kiring." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov formati noto‘g‘ri." }, { status: 400 }); }
  const query = body && typeof body === "object" && typeof (body as { query?: unknown }).query === "string"
    ? (body as { query: string }).query.trim().slice(0, 180)
    : "";
  if (!query) return NextResponse.json({ error: "Video mavzusi ko‘rsatilmagan." }, { status: 400 });

  const youtubeSearchUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(query);
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ videos: [], youtubeSearchUrl, source: "youtube-search-link" });

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "3",
      order: "relevance",
      safeSearch: "strict",
      relevanceLanguage: "uz",
      regionCode: "UZ",
      videoEmbeddable: "true",
      key: apiKey,
    });
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString(), { cache: "no-store" });
    if (!response.ok) {
      console.error("YouTube search API failed:", response.status, (await response.text()).slice(0, 400));
      return NextResponse.json({ videos: [], youtubeSearchUrl, source: "youtube-search-link" });
    }
    const data = await response.json() as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } } };
      }>;
    };
    const videos = (data.items ?? []).flatMap((item) => {
      const id = item.id?.videoId;
      if (!id) return [];
      return [{
        id,
        title: item.snippet?.title ?? "Kimyo darsi",
        channelTitle: item.snippet?.channelTitle ?? "YouTube",
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        url: "https://www.youtube.com/watch?v=" + id,
      }];
    });
    return NextResponse.json({ videos, youtubeSearchUrl, source: "youtube-api" });
  } catch (error) {
    console.error("YouTube video lookup failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ videos: [], youtubeSearchUrl, source: "youtube-search-link" });
  }
}
