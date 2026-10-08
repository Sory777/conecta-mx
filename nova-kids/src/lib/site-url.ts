import "server-only";

/** URL base para retornos de pago: la configurada o, en su defecto, la de la petición. */
export function siteUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(req.url).origin;
}
