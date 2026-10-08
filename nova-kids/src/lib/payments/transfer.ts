import "server-only";
import type { PaymentProvider } from "./types";

// Transferencia / pago por confirmar. Siempre disponible: si no hay CLABE configurada,
// la tienda contacta al cliente para enviar los datos de pago.

export const transfer: PaymentProvider = {
  id: "transferencia",
  label: "Transferencia bancaria",
  description: "Recibe los datos de pago y confirma tu pedido al transferir.",
  enabled: () => true,
  async start() {
    return { type: "instructions" };
  },
};

export function bankDetails() {
  const clabe = process.env.BANK_TRANSFER_CLABE;
  if (!clabe) return null;
  return {
    bank: process.env.BANK_TRANSFER_BANK ?? "",
    holder: process.env.BANK_TRANSFER_HOLDER ?? "",
    clabe,
  };
}
