import type { Order, PaymentMethodId } from "../types";

export type PaymentStart =
  | { type: "redirect"; url: string; reference?: string }
  | { type: "instructions" };

export interface PaymentProvider {
  id: PaymentMethodId;
  label: string;
  description: string;
  /** Se activa solo si sus variables de entorno existen. */
  enabled(): boolean;
  start(order: Order, ctx: { baseUrl: string }): Promise<PaymentStart>;
}

/** Datos públicos que se envían al navegador en el checkout. */
export interface PaymentMethodInfo {
  id: PaymentMethodId;
  label: string;
  description: string;
}
