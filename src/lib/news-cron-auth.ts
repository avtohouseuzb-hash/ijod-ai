import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export async function isNewsCronAuthorized(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !key) return false;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("news_cron_auth").select("token_hash").eq("id", true).maybeSingle();
  if (error || !data?.token_hash) return false;
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(String(data.token_hash), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
