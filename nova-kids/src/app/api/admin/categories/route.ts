import { NextResponse } from "next/server";
import { repo } from "@/lib/data";
import { requireAdminApi } from "@/lib/admin-guard";
import { categoryInputSchema, firstIssue } from "@/lib/admin-validation";
import { errorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const parsed = categoryInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json({ category: await repo().createCategory(parsed.data) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
