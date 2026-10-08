import { NextResponse } from "next/server";
import { repo } from "@/lib/data";
import { requireAdminApi } from "@/lib/admin-guard";
import { firstIssue, productInputSchema, productPatchSchema } from "@/lib/admin-validation";
import { errorResponse } from "@/lib/api-errors";

type Ctx = { params: Promise<{ id: string }> };

/** PUT: reemplaza todos los campos editables. */
export async function PUT(req: Request, { params }: Ctx) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await params;
  const parsed = productInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json({ product: await repo().updateProduct(id, parsed.data) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH: cambios rápidos desde la lista (activar / desactivar). */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await params;
  const parsed = productPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json({ product: await repo().updateProduct(id, parsed.data) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await params;
  try {
    await repo().deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
