// Adaptadores de redes de anuncios. El servidor decide QUÉ red mostrar (mediación) y entrega su configuración
// pública (IDs de bloque/zona). Aquí sólo se carga el SDK de esa red y se muestra el anuncio.
// La recompensa nunca se decide en el cliente: se reporta el resultado y el servidor verifica.
// Verifica los nombres de parámetros en el panel de cada red: sus SDK cambian con el tiempo.

export type AdResult = 'completed' | 'closed' | 'no_fill' | 'error';
export interface AdNetworkInfo {
  id: string;
  kind: 'sandbox' | 'adsgram' | 'monetag' | 'adsense_h5';
  config: Record<string, string>;
  serverVerified: boolean;
}

const loaded = new Map<string, Promise<void>>();
function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  const key = src + JSON.stringify(attrs);
  let p = loaded.get(key);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.append(s);
    });
    loaded.set(key, p);
  }
  return p;
}

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

// ------------------------------------------------------------------ Adsgram (Telegram)
// SDK: https://sad.adsgram.ai/js/sad.min.js → window.Adsgram.init({ blockId }).show()
// show() se resuelve cuando el usuario termina el anuncio y se rechaza si no hay anuncio o hay error.
async function showAdsgram(net: AdNetworkInfo, format: 'rewarded' | 'interstitial'): Promise<AdResult> {
  const blockId = format === 'rewarded' ? net.config.rewardedBlockId : net.config.interstitialBlockId;
  if (!blockId) return 'no_fill';
  await loadScript('https://sad.adsgram.ai/js/sad.min.js');
  const Adsgram = (window as unknown as { Adsgram?: { init(o: { blockId: string }): { show(): Promise<{ done: boolean }> } } }).Adsgram;
  if (!Adsgram) return 'error';
  try {
    const r = await Adsgram.init({ blockId }).show();
    return r?.done === false ? 'closed' : 'completed';
  } catch (e) {
    const d = String((e as { description?: string })?.description ?? e);
    return /no.*(ad|banner)|not available/i.test(d) ? 'no_fill' : 'error';
  }
}

// ------------------------------------------------------------------ Monetag (Telegram y web)
// SDK: <script src="//libtl.com/sdk.js" data-zone="ZONA" data-sdk="show_ZONA"> → window.show_ZONA(opts)
// El `ymid` viaja al postback de Monetag para que el servidor sepa qué vista confirmar.
async function showMonetag(net: AdNetworkInfo, format: 'rewarded' | 'interstitial', token: string): Promise<AdResult> {
  const zone = net.config.zoneId;
  if (!zone) return 'no_fill';
  const fn = `show_${zone}`;
  await loadScript('https://libtl.com/sdk.js', { 'data-zone': zone, 'data-sdk': fn });
  const show = (window as unknown as Record<string, (o?: unknown) => Promise<unknown>>)[fn];
  if (typeof show !== 'function') return 'error';
  try {
    void format; // Monetag: el mismo «Rewarded Interstitial» sirve para ambos formatos
    await show({ ymid: token });
    return 'completed';
  } catch {
    return 'no_fill';
  }
}

// ------------------------------------------------------------------ Google AdSense H5 Games (web)
// Ad Placement API: adBreak({ type: 'reward' | 'next', ... }). Requiere cuenta AdSense aprobada para juegos H5.
async function showAdsenseH5(net: AdNetworkInfo, format: 'rewarded' | 'interstitial', sandbox: boolean): Promise<AdResult> {
  const client = net.config.client;
  if (!client) return 'no_fill';
  await loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`, {
    crossorigin: 'anonymous',
    'data-ad-client': client,
    ...(sandbox ? { 'data-adbreak-test': 'on' } : {}),
  });
  const w = window as unknown as { adsbygoogle: unknown[]; adBreak?: (o: unknown) => void };
  w.adsbygoogle = w.adsbygoogle || [];
  const adBreak = w.adBreak ?? ((o: unknown) => w.adsbygoogle.push(o));
  return withTimeout(
    new Promise<AdResult>((resolve) => {
      let viewed = false;
      if (format === 'rewarded') {
        adBreak({
          type: 'reward',
          name: 'recompensa',
          beforeReward: (showAdFn: () => void) => showAdFn(),
          adViewed: () => (viewed = true),
          adDismissed: () => resolve('closed'),
          adBreakDone: (info: { breakStatus?: string }) => resolve(viewed || info?.breakStatus === 'viewed' ? 'completed' : 'no_fill'),
        });
      } else {
        adBreak({ type: 'next', name: 'pausa', adBreakDone: (info: { breakStatus?: string }) => resolve(info?.breakStatus === 'viewed' ? 'completed' : 'no_fill') });
      }
    }),
    60_000,
    'error',
  );
}

export async function showAd(net: AdNetworkInfo, format: 'rewarded' | 'interstitial', token: string, opts: { sandboxUi: () => Promise<AdResult>; testMode: boolean }): Promise<AdResult> {
  try {
    switch (net.kind) {
      case 'adsgram':
        return await showAdsgram(net, format);
      case 'monetag':
        return await showMonetag(net, format, token);
      case 'adsense_h5':
        return await showAdsenseH5(net, format, opts.testMode);
      default:
        return await opts.sandboxUi();
    }
  } catch {
    return 'error';
  }
}
