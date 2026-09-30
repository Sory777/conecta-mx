// Scheduled posts live in this browser's IndexedDB (image blobs are too big
// for localStorage). The app checks for due posts while it is open and
// notifies the owner; the owner then publishes with one tap (share sheet).

export type PostStatus = 'scheduled' | 'ready' | 'published';

export interface ScheduledPost {
  id: string;
  createdAt: number;
  scheduledAt: number;
  status: PostStatus;
  image: Blob;
  caption: string;
  headline: string;
  publishedAt?: number;
}

const DB_NAME = 'cmx_posts';
const STORE = 'posts';
export const POSTS_CHANGED_EVENT = 'cmx-posts-changed';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

function changed() {
  window.dispatchEvent(new Event(POSTS_CHANGED_EVENT));
}

export async function listPosts(): Promise<ScheduledPost[]> {
  const all = await tx<ScheduledPost[]>('readonly', (s) => s.getAll());
  return all.sort((a, b) => a.scheduledAt - b.scheduledAt);
}

export async function savePost(post: ScheduledPost) {
  await tx('readwrite', (s) => s.put(post));
  changed();
}

export async function deletePost(id: string) {
  await tx('readwrite', (s) => s.delete(id));
  changed();
}

export async function markPublished(post: ScheduledPost) {
  await savePost({ ...post, status: 'published', publishedAt: Date.now() });
  await notify('✅ ¡Tu anuncio se publicó!', `"${post.headline}" ya está en tus redes.`);
}

// --- Best times -----------------------------------------------------------
// Peak engagement windows for cafés and dessert shops in Mexico: the morning
// coffee run, the after-lunch sweet craving, and the evening outing; on
// weekends people browse later in the morning.

interface Slot { hour: number; minute: number; reason: string }

const WEEKDAY_SLOTS: Slot[] = [
  { hour: 8, minute: 0, reason: 'Hora del café de la mañana' },
  { hour: 13, minute: 30, reason: 'Antojo después de la comida' },
  { hour: 18, minute: 30, reason: 'Salida de la tarde' },
];
const WEEKEND_SLOTS: Slot[] = [
  { hour: 10, minute: 30, reason: 'Desayuno de fin de semana' },
  { hour: 17, minute: 0, reason: 'Paseo familiar de la tarde' },
];

export interface SuggestedTime { date: Date; reason: string }

export function suggestTimes(count = 3, from = new Date()): SuggestedTime[] {
  const out: SuggestedTime[] = [];
  const minLead = from.getTime() + 15 * 60 * 1000;
  for (let d = 0; d < 8 && out.length < count; d++) {
    const day = new Date(from);
    day.setDate(from.getDate() + d);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    for (const s of weekend ? WEEKEND_SLOTS : WEEKDAY_SLOTS) {
      const t = new Date(day);
      t.setHours(s.hour, s.minute, 0, 0);
      if (t.getTime() >= minLead && out.length < count) out.push({ date: t, reason: s.reason });
    }
  }
  return out;
}

export function formatWhen(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Hoy, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Mañana, ${time}`;
  const day = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${time}`;
}

// --- Notifications ----------------------------------------------------------

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function notify(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options: NotificationOptions = { body, icon: '/icon.svg', badge: '/icon.svg', tag: `cmx-post-${Date.now()}` };
  try {
    // Mobile Chrome only allows notifications through the service worker.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, { ...options, data: { url: '/#/anuncios' } }); return; }
    new Notification(title, options);
  } catch {
    /* notification not supported in this context */
  }
}

// Moves posts whose time has come from "scheduled" to "ready" and alerts the
// owner. Returns the posts that just became ready.
export async function checkDuePosts(): Promise<ScheduledPost[]> {
  const now = Date.now();
  const due = (await listPosts()).filter((p) => p.status === 'scheduled' && p.scheduledAt <= now);
  for (const p of due) {
    await tx('readwrite', (s) => s.put({ ...p, status: 'ready' }));
    await notify('📣 ¡Es hora de publicar tu anuncio!', `"${p.headline}" está listo. Toca para publicarlo.`);
  }
  if (due.length) changed();
  return due;
}

export async function sharePost(image: Blob, caption: string, fileName = 'anuncio.jpg'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([image], fileName, { type: image.type || 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: caption });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(image, fileName);
  try { await navigator.clipboard.writeText(caption); } catch { /* ignore */ }
  return 'downloaded';
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
