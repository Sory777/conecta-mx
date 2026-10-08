import { NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/data";

const schema = z.object({ number: z.string().trim().min(3).max(20), email: z.string().trim().toLowerCase().email() });

/** Consulta de pedido por número + correo (sin cuenta). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe tu número de pedido y correo." }, { status: 400 });
  const order = await repo().getOrderByNumber(parsed.data.number);
  if (!order || order.customer.email.toLowerCase() !== parsed.data.email) {
    return NextResponse.json({ error: "No encontramos un pedido con esos datos." }, { status: 404 });
  }
  return NextResponse.json({ id: order.id });
}
