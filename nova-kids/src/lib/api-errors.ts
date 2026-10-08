import "server-only";
import { NextResponse } from "next/server";
import { ConflictError, NotFoundError } from "./data";

export function errorResponse(err: unknown) {
  if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
  console.error(err);
  return NextResponse.json({ error: "Error inesperado. Intenta de nuevo." }, { status: 500 });
}
