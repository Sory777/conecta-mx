import { NextResponse } from "next/server";
import { z } from "zod";
import { applyCoupon } from "@/lib/coupons";

const schema = z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().min(0) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Escribe un cupón." }, { status: 400 });
  const result = applyCoupon(parsed.data.code, parsed.data.subtotal);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
