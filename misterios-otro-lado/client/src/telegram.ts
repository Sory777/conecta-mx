// Puente con Telegram Mini Apps. El SDK oficial sólo se carga si el juego se abre dentro de Telegram
// (Telegram añade #tgWebAppData=... a la URL). Fuera de Telegram todo sigue funcionando igual.

interface TgWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string }; start_param?: string };
  platform: string;
  version: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  close(): void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  openInvoice(url: string, cb?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
  openLink(url: string, opts?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  isVersionAtLeast?: (v: string) => boolean;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: { impactOccurred(s: 'light' | 'medium' | 'heavy'): void; notificationOccurred(t: 'success' | 'warning' | 'error'): void };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

let app: TgWebApp | null = null;

export function insideTelegram(): boolean {
  return location.hash.includes('tgWebAppData') || !!window.Telegram?.WebApp?.initData;
}

export async function initTelegram(): Promise<TgWebApp | null> {
  if (!insideTelegram()) return null;
  if (!window.Telegram?.WebApp) {
    await new Promise<void>((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://telegram.org/js/telegram-web-app.js';
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.append(s);
    });
  }
  const wa = window.Telegram?.WebApp;
  if (!wa?.initData) return null;
  app = wa;
  wa.ready();
  wa.expand();
  wa.disableVerticalSwipes?.(); // evita que deslizar la cámara cierre la Mini App
  wa.setHeaderColor?.('#0b0d10');
  wa.setBackgroundColor?.('#0b0d10');
  document.body.classList.add('in-telegram');
  return wa;
}

export const tg = {
  get active() {
    return !!app;
  },
  get initData() {
    return app?.initData ?? '';
  },
  get firstName() {
    return app?.initDataUnsafe?.user?.first_name ?? null;
  },
  haptic(kind: 'success' | 'warning' | 'error' | 'light') {
    if (!app?.HapticFeedback) return;
    if (kind === 'light') app.HapticFeedback.impactOccurred('light');
    else app.HapticFeedback.notificationOccurred(kind);
  },
  openInvoice(url: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
    return new Promise((resolve) => (app ? app.openInvoice(url, resolve) : resolve('failed')));
  },
  openLink(url: string) {
    if (app) app.openLink(url);
    else window.open(url, '_blank', 'noopener');
  },
  share(url: string, text: string) {
    const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (app) app.openTelegramLink(share);
    else if (navigator.share) void navigator.share({ url, text }).catch(() => undefined);
    else window.open(share, '_blank', 'noopener');
  },
  /** Botón «Atrás» nativo de Telegram (cierra paneles). */
  backButton(show: boolean, onClick?: () => void) {
    if (!app) return;
    if (onClick) {
      app.BackButton.onClick(onClick);
    }
    if (show) app.BackButton.show();
    else app.BackButton.hide();
  },
  offBack(cb: () => void) {
    app?.BackButton.offClick(cb);
  },
};
