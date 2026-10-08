import { NextResponse } from "next/server";
import { repo } from "@/lib/data";
import { requireAdminApi } from "@/lib/admin-guard";
import { firstIssue, productInputSchema } from "@/lib/admin-validation";
import { errorResponse } from "@/lib/api-errors";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  return NextResponse.json({ products: await repo().listProducts({ includeInactive: true }) });
}

export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const parsed = productInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json({ product: await repo().createProduct(parsed.data) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
