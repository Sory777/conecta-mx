import type { AppConfig } from '../../config/env';
import type { Db } from '../../db/database';
import type { Logger } from '../../lib/logger';
import type { OffersService, StarsApi } from '../store/offers';
import { verifyInitData } from './initData';

type ApiFn = (method: string, params: Record<string, unknown>) => Promise<any>;

interface Update {
  update_id: number;
  message?: {
    chat: { id: number };
    from?: { id: number; first_name?: string; language_code?: string };
    text?: string;
    successful_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string };
  };
  pre_checkout_query?: { id: string; from: { id: number }; currency: string; total_amount: number; invoice_payload: string };
}

/**
 * Integración con Telegram (Bot API oficial, sin dependencias):
 *  - Mini App: verificación del initData (ver initData.ts) y enlaces de invitación.
 *  - Bot: /start y /ayuda con botón para abrir el juego, botón de menú «Jugar».
 *  - Pagos con Telegram Stars (XTR): factura → pre_checkout_query → successful_payment.
 * Las actualizaciones llegan por long polling (desarrollo/servidor simple) o webhook (producción).
 */
export class TelegramService implements StarsApi {
  private offset = 0;
  private running = false;
  offers: OffersService | null = null;
  /** Sustituible en pruebas. */
  api: ApiFn = async (method, params) => {
    const res = await fetch(`https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(method === 'getUpdates' ? 40_000 : 10_000),
    });
    const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
    if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? res.status}`);
    return data.result;
  };

  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
    private readonly log: Logger,
  ) {}

  get enabled() {
    return !!this.config.TELEGRAM_BOT_TOKEN;
  }

  get starsEnabled() {
    return this.enabled && this.config.TELEGRAM_STARS_ENABLED;
  }

  verify(initData: string) {
    if (!this.config.TELEGRAM_BOT_TOKEN) return null;
    return verifyInitData(initData, this.config.TELEGRAM_BOT_TOKEN, this.config.TELEGRAM_INITDATA_MAX_AGE_SEC);
  }

  telegramIdOf(userId: string): string | null {
    return this.db.get<{ telegram_id: string }>('SELECT telegram_id FROM telegram_accounts WHERE user_id = ?', userId)?.telegram_id ?? null;
  }

  /** Enlace para invitar amigos: abre la Mini App con el código de referido como start_param. */
  inviteLink(code: string): string | null {
    const bot = this.config.TELEGRAM_BOT_USERNAME;
    if (!bot) return null;
    return this.config.TELEGRAM_APP_SHORT_NAME ? `https://t.me/${bot}/${this.config.TELEGRAM_APP_SHORT_NAME}?startapp=${code}` : `https://t.me/${bot}?start=${code}`;
  }

  publicInfo() {
    return {
      enabled: this.enabled,
      botUsername: this.config.TELEGRAM_BOT_USERNAME ?? null,
      appShortName: this.config.TELEGRAM_APP_SHORT_NAME ?? null,
      stars: this.starsEnabled,
    };
  }

  async createStarsInvoice(p: { title: string; description: string; payload: string; stars: number }): Promise<string> {
    // Para Stars (XTR) el provider_token es una cadena vacía y hay un único precio.
    return this.api('createInvoiceLink', {
      title: p.title,
      description: p.description,
      payload: p.payload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: p.title, amount: p.stars }],
    });
  }

  async refundStars(telegramUserId: string, chargeId: string) {
    await this.api('refundStarPayment', { user_id: Number(telegramUserId), telegram_payment_charge_id: chargeId });
  }

  // ------------------------------------------------------------------ ciclo de vida

  async start() {
    if (!this.enabled) return;
    const url = this.config.TELEGRAM_WEBAPP_URL;
    try {
      if (url) {
        await this.api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Jugar', web_app: { url } } });
      }
      if (this.config.TELEGRAM_UPDATES === 'webhook') {
        const hook = `${this.config.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/telegram/webhook`;
        await this.api('setWebhook', {
          url: hook,
          secret_token: this.config.TELEGRAM_WEBHOOK_SECRET,
          allowed_updates: ['message', 'pre_checkout_query'],
          drop_pending_updates: false,
        });
        this.log.info('telegram webhook configured', { hook });
      } else if (this.config.TELEGRAM_UPDATES === 'polling') {
        await this.api('deleteWebhook', { drop_pending_updates: false });
        this.running = true;
        void this.poll();
        this.log.info('telegram polling started');
      }
    } catch (e) {
      this.log.error('telegram start failed', { err: String(e) });
    }
  }

  stop() {
    this.running = false;
  }

  private async poll() {
    while (this.running) {
      try {
        const updates: Update[] = await this.api('getUpdates', { offset: this.offset, timeout: 25, allowed_updates: ['message', 'pre_checkout_query'] });
        for (const u of updates) {
          this.offset = u.update_id + 1;
          await this.handleUpdate(u);
        }
      } catch (e) {
        if (this.running) {
          this.log.warn('telegram polling error', { err: String(e) });
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
  }

  // ------------------------------------------------------------------ actualizaciones

  async handleUpdate(u: Update) {
    try {
      if (u.pre_checkout_query) {
        const q = u.pre_checkout_query;
        const v = this.offers?.validatePreCheckout({
          fromTelegramId: String(q.from.id),
          payload: q.invoice_payload,
          currency: q.currency,
          totalAmount: q.total_amount,
        }) ?? { ok: false, error: 'Tienda no disponible.' };
        await this.api('answerPreCheckoutQuery', v.ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: v.error });
        return;
      }
      const m = u.message;
      if (!m) return;
      if (m.successful_payment && m.from) {
        const sp = m.successful_payment;
        const r = this.offers?.onStarsPaid({
          fromTelegramId: String(m.from.id),
          payload: sp.invoice_payload,
          currency: sp.currency,
          totalAmount: sp.total_amount,
          chargeId: sp.telegram_payment_charge_id,
        });
        this.log.info('stars payment', { charge: sp.telegram_payment_charge_id, stars: sp.total_amount, ok: !!r });
        return;
      }
      if (m.text?.startsWith('/start') || m.text?.startsWith('/ayuda') || m.text?.startsWith('/help')) {
        const payload = m.text.split(' ')[1]?.replace(/[^A-Za-z0-9]/g, '').slice(0, 16) ?? '';
        await this.sendWelcome(m.chat.id, payload);
      }
    } catch (e) {
      this.log.error('telegram update failed', { err: String(e), update: u.update_id });
    }
  }

  private async sendWelcome(chatId: number, refCode: string) {
    const url = this.config.TELEGRAM_WEBAPP_URL;
    const text =
      '🔍 *Misterios: El Otro Lado*\n\nHace treinta años una familia desapareció en San Bartolo del Monte. Esta noche alguien encendió una luz en la casa de la colina.\n\nInvestiga con tus amigos, resuelve misterios y consigue recompensas.';
    const webAppUrl = url ? (refCode ? `${url}${url.includes('?') ? '&' : '?'}ref=${refCode}` : url) : null;
    await this.api('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: webAppUrl ? { inline_keyboard: [[{ text: '🔦 Jugar ahora', web_app: { url: webAppUrl } }]] } : undefined,
    });
  }
}
