import { NextResponse } from "next/server";
import { repo } from "@/lib/data";
import { requireAdminApi } from "@/lib/admin-guard";
import { firstIssue, orderStatusSchema } from "@/lib/admin-validation";
import { errorResponse } from "@/lib/api-errors";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await params;
  const parsed = orderStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json({ order: await repo().updateOrderStatus(id, parsed.data.status, parsed.data.note) });
  } catch (err) {
    return errorResponse(err);
  }
}
