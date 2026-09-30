import type { AppConfig } from '../../config/env';
import type { Logger } from '../../lib/logger';

/**
 * Envío de correos. En el MVP sólo existe el proveedor "console" (desarrollo/sandbox):
 * el enlace se escribe en el log del servidor. Para producción hay que integrar un proveedor
 * real (SMTP, Amazon SES, Resend, SendGrid…) implementando esta interfaz. Ver README.
 */
export interface Mailer {
  readonly available: boolean;
  send(to: string, subject: string, body: string): void;
}

export function createMailer(config: AppConfig, log: Logger): Mailer {
  if (config.MAIL_PROVIDER === 'console') {
    return {
      available: true,
      send(to, subject, body) {
        log.info('[SANDBOX MAIL] correo NO enviado; contenido mostrado sólo en consola', { to, subject, body });
      },
    };
  }
  return {
    available: false,
    send(to, subject) {
      log.warn('mail provider not configured; email dropped', { to, subject });
    },
  };
}
