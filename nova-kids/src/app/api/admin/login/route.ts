import { NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_HOURS, adminConfigured, checkPassword, createSessionToken } from "@/lib/admin-session";

const attempts = new Map<string, { count: number; until: number }>();

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Define ADMIN_PASSWORD en las variables de entorno para activar el panel." }, { status: 503 });
  }
  // Freno básico contra fuerza bruta: 5 intentos fallidos → 10 minutos de espera.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const record = attempts.get(ip);
  if (record && record.count >= 5 && record.until > Date.now()) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !(await checkPassword(password))) {
    const count = (record && record.until > Date.now() ? record.count : 0) + 1;
    attempts.set(ip, { count, until: Date.now() + 10 * 60_000 });
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
}
