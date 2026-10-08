import "server-only";
import { coupons } from "@/config/coupons";
import { round2 } from "./pricing";

export type CouponResult = { ok: true; code: string; discount: number } | { ok: false; error: string };

export function applyCoupon(rawCode: string, subtotal: number): CouponResult {
  const code = rawCode.trim().toUpperCase();
  const coupon = coupons.find((c) => c.active && c.code.toUpperCase() === code);
  if (!coupon) return { ok: false, error: "El cupón no es válido." };
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return { ok: false, error: `Este cupón aplica en compras desde $${coupon.minSubtotal} MXN.` };
  }
  const discount = coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return { ok: true, code, discount: round2(Math.min(discount, subtotal)) };
}
