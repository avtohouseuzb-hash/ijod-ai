import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type EduLiveStudentContext = {
  ok: true;
  user: User;
  service: SupabaseClient;
  grade: number;
  displayName: string;
};

export type EduLiveContextError = {
  ok: false;
  status: 401 | 403 | 500;
  message: string;
};

export async function getEduLiveStudentContext(request: Request): Promise<EduLiveStudentContext | EduLiveContextError> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !secret) return { ok: false, status: 500, message: "Supabase server sozlamalari to‘liq emas." };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return { ok: false, status: 401, message: "Darsni boshlash uchun hisobingizga kiring." };

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return { ok: false, status: 401, message: "Sessiya tugagan. Qayta kiring." };

  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: role, error: roleError } = await service
    .from("edu_user_roles")
    .select("role,grade,display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) return { ok: false, status: 500, message: "O‘quvchi profilini tekshirishda xatolik." };
  if (!role || role.role !== "student") return { ok: false, status: 403, message: "Live Classroom faqat o‘quvchi profili orqali ishlaydi." };
  if (!Number.isInteger(role.grade) || role.grade < 1 || role.grade > 11) return { ok: false, status: 403, message: "O‘quvchi sinfi profilida to‘g‘ri saqlanmagan." };

  return { ok: true, user, service, grade: role.grade, displayName: role.display_name };
}
