import { randomToken } from '../../lib/ids';

/**
 * Proveedores de pago de dinero real.
 * En el MVP SÓLO existe `SandboxPaymentProvider`: no cobra nada y marca todo como sandbox.
 * Integraciones reales pendientes (ver README > Pagos):
 *   - Google Play Billing: verificación de purchaseToken en servidor con la Google Play Developer API
 *     (cuenta de servicio de Google Cloud con acceso a Play Console).
 *   - Apple App Store: App Store Server API (clave .p8 de App Store Connect).
 *   - Stripe (web): Checkout + webhooks firmados (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET).
 * Todas deben conceder moneda sólo tras verificar el recibo EN EL SERVIDOR.
 */
export interface PaymentVerification {
  valid: boolean;
  providerRef: string;
  amountCents: number;
  currency: string;
  sandbox: boolean;
}

export interface PaymentProvider {
  readonly id: string;
  readonly sandbox: boolean;
  verify(input: { sku: string; priceCents: number; currency: string; receipt?: string }): Promise<PaymentVerification>;
}

export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = 'sandbox';
  readonly sandbox = true;
  async verify(input: { sku: string; priceCents: number; currency: string }): Promise<PaymentVerification> {
    return { valid: true, providerRef: `sandbox_${randomToken(12)}`, amountCents: input.priceCents, currency: input.currency, sandbox: true };
  }
}
