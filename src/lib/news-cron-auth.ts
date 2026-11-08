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

/** Allows the scheduled secret or a verified allow-listed IJOD AI admin session. */
export async function isNewsCronOrAdminAuthorized(request: Request): Promise<boolean> {
  if (await isNewsCronAuthorized(request)) return true;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !publicKey) return false;
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user?.email) return false;
  const admins = (process.env.AI_NEWS_ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}
