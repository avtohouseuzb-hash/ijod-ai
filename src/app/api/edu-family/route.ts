import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

function clients(token: string) {
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return { auth, service, token };
}

async function currentUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token || !url || !anon || !secret) return null;
  const { auth, service } = clients(token);
  const { data: { user }, error } = await auth.auth.getUser(token);
  return error || !user ? null : { user, service };
}

export async function GET(request: Request) {
  const ctx = await currentUser(request);
  if (!ctx) return NextResponse.json({ error: "Hisobingizga qayta kiring." }, { status: 401 });
  const { data: role, error } = await ctx.service.from("edu_user_roles").select("*").eq("user_id", ctx.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Profilni yuklashda xatolik." }, { status: 500 });
  if (!role) return NextResponse.json({ role: null, links: [], requests: [] });
  if (role.role === "student") {
    const { data: links, error: linkError } = await ctx.service.from("edu_parent_student_links").select("id,parent_user_id,status,requested_at").eq("student_user_id", ctx.user.id).order("requested_at", { ascending: false });
    if (linkError) return NextResponse.json({ error: "Bog‘lanishlarni yuklab bo‘lmadi." }, { status: 500 });
    const parentIds = [...new Set((links ?? []).map((x) => x.parent_user_id))];
    const { data: parents } = parentIds.length ? await ctx.service.from("edu_user_roles").select("user_id,display_name").in("user_id", parentIds) : { data: [] };
    return NextResponse.json({ role, links: (links ?? []).map((link) => ({ ...link, parent: parents?.find((p) => p.user_id === link.parent_user_id)?.display_name ?? "Ota-ona" })), requests: [] });
  }
  const { data: links, error: linkError } = await ctx.service.from("edu_parent_student_links").select("id,student_user_id,status,requested_at,approved_at").eq("parent_user_id", ctx.user.id).order("created_at", { ascending: false });
  if (linkError) return NextResponse.json({ error: "Farzandlar ro‘yxatini yuklab bo‘lmadi." }, { status: 500 });
  const studentIds = [...new Set((links ?? []).map((x) => x.student_user_id))];
  const { data: students } = studentIds.length ? await ctx.service.from("edu_user_roles").select("user_id,display_name,grade").in("user_id", studentIds) : { data: [] };
  return NextResponse.json({ role, links: (links ?? []).map((link) => ({ ...link, student: students?.find((s) => s.user_id === link.student_user_id) ?? null })), requests: [] });
}

export async function POST(request: Request) {
  const ctx = await currentUser(request);
  if (!ctx) return NextResponse.json({ error: "Hisobingizga qayta kiring." }, { status: 401 });
  let body: { action?: string; role?: string; displayName?: string; grade?: number; code?: string; linkId?: string; decision?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "So‘rov noto‘g‘ri." }, { status: 400 }); }
  const { service } = ctx;

  if (body.action === "set-role") {
    if (!["student", "parent"].includes(body.role || "") || typeof body.displayName !== "string" || body.displayName.trim().length < 2 || body.displayName.trim().length > 100) return NextResponse.json({ error: "Rol va ismni to‘g‘ri kiriting." }, { status: 400 });
    const grade = body.role === "student" ? Number(body.grade) : null;
    if (body.role === "student" && (!Number.isInteger(grade) || grade! < 1 || grade! > 11)) return NextResponse.json({ error: "Sinfni 1–11 oralig‘ida tanlang." }, { status: 400 });
    const { data: existing } = await service.from("edu_user_roles").select("user_id").eq("user_id", ctx.user.id).maybeSingle();
    if (existing) return NextResponse.json({ error: "Rol avval tanlangan. Uni almashtirish uchun yordam xizmatiga murojaat qiling." }, { status: 409 });
    const { data, error } = await service.from("edu_user_roles").insert({ user_id: ctx.user.id, role: body.role, display_name: body.displayName.trim(), grade }).select("*").single();
    if (error) return NextResponse.json({ error: "Profilni saqlab bo‘lmadi." }, { status: 500 });
    return NextResponse.json({ role: data });
  }

  const { data: role } = await service.from("edu_user_roles").select("*").eq("user_id", ctx.user.id).maybeSingle();
  if (!role) return NextResponse.json({ error: "Avval IJOD EDU profilingizni sozlang." }, { status: 403 });

  if (body.action === "create-link-code") {
    if (role.role !== "student") return NextResponse.json({ error: "Bog‘lash kodini faqat o‘quvchi yaratadi." }, { status: 403 });
    const code = randomBytes(4).toString("hex").toUpperCase();
    const codeHash = createHash("sha256").update(code).digest("hex");
    const { error } = await service.from("edu_student_link_codes").insert({ student_user_id: ctx.user.id, code_hash: codeHash, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (error) return NextResponse.json({ error: "Kod yaratilmadi. Qayta urinib ko‘ring." }, { status: 500 });
    return NextResponse.json({ code, expiresInMinutes: 10 });
  }

  if (body.action === "request-link") {
    if (role.role !== "parent") return NextResponse.json({ error: "Bu amal faqat ota-ona uchun." }, { status: 403 });
    const code = (body.code || "").replace(/\s/g, "").toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(code)) return NextResponse.json({ error: "8 belgili kodni kiriting." }, { status: 400 });
    const codeHash = createHash("sha256").update(code).digest("hex");
    const { error } = await service.rpc("redeem_edu_student_link_code", { p_code_hash: codeHash, p_parent_user_id: ctx.user.id });
    if (error) return NextResponse.json({ error: "Kod noto‘g‘ri, muddati tugagan yoki allaqachon ishlatilgan." }, { status: 400 });
    return NextResponse.json({ success: true, message: "So‘rov yuborildi. Farzandingiz tasdiqlashi kerak." });
  }

  if (body.action === "decide-link") {
    if (role.role !== "student" || typeof body.linkId !== "string" || !["active", "rejected"].includes(body.decision || "")) return NextResponse.json({ error: "Ruxsat berilmadi." }, { status: 403 });
    const { data, error } = await service.from("edu_parent_student_links").update({ status: body.decision, approved_at: body.decision === "active" ? new Date().toISOString() : null }).eq("id", body.linkId).eq("student_user_id", ctx.user.id).eq("status", "pending").select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "So‘rov topilmadi yoki avval ko‘rib chiqilgan." }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "unlink") {
    if (role.role !== "parent" || typeof body.linkId !== "string") return NextResponse.json({ error: "Ruxsat berilmadi." }, { status: 403 });
    const { error } = await service.from("edu_parent_student_links").delete().eq("id", body.linkId).eq("parent_user_id", ctx.user.id);
    if (error) return NextResponse.json({ error: "Bog‘lanishni bekor qilib bo‘lmadi." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Noma’lum amal." }, { status: 400 });
}
