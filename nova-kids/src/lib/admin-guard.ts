import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "./admin-session";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/** Para rutas API del panel: devuelve una respuesta 401 si no hay sesión. */
export async function requireAdminApi(): Promise<NextResponse | null> {
  return (await isAdmin()) ? null : NextResponse.json({ error: "No autorizado" }, { status: 401 });
}
