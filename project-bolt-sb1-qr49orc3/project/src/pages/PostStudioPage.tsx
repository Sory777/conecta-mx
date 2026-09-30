import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, ImagePlus, Download, Share2, CalendarClock, Clock, Bell, CheckCircle2, Trash2,
  Copy, Sparkles, ChevronDown, RefreshCw, MessageCircle,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import {
  POST_TEMPLATES, POST_STYLES, FORMAT_SIZES, suggestTemplate, renderPost, ensureFonts, loadImage,
  canvasToBlob, buildCaption, type PostTemplate, type PostStyle, type PostFormat,
} from '../lib/postDesign';
import {
  listPosts, savePost, deletePost, markPublished, suggestTimes, formatWhen, requestNotificationPermission,
  sharePost, downloadBlob, POSTS_CHANGED_EVENT, type ScheduledPost,
} from '../lib/postScheduler';

const MAX_TEXT = 90;

function readSetting(key: string, fallback = '') {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function writeSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostStudioPage() {
  const { toast } = useToast();
  const { business } = useAuth();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [text, setText] = useState('');
  const [template, setTemplate] = useState<PostTemplate>(POST_TEMPLATES[0]);
  const [templateTouched, setTemplateTouched] = useState(false);
  const [style, setStyle] = useState<PostStyle>('clasico');
  const [format, setFormat] = useState<PostFormat>('post');
  const [businessName, setBusinessName] = useState(() => readSetting('cmx_post_business', business?.name || ''));
  const [ownerWhatsapp, setOwnerWhatsapp] = useState(() => readSetting('cmx_post_owner_wa', business?.whatsapp || ''));
  const [showMore, setShowMore] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [customWhen, setCustomWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [justPublished, setJustPublished] = useState<ScheduledPost | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!businessName && business?.name) setBusinessName(business.name);
    if (!ownerWhatsapp && business?.whatsapp) setOwnerWhatsapp(business.whatsapp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  useEffect(() => { writeSetting('cmx_post_business', businessName); }, [businessName]);
  useEffect(() => { writeSetting('cmx_post_owner_wa', ownerWhatsapp); }, [ownerWhatsapp]);

  // Pick the matching template from the text until the owner picks one.
  useEffect(() => {
    if (!templateTouched && text) setTemplate(suggestTemplate(text));
  }, [text, templateTouched]);

  const refreshPosts = useCallback(() => {
    listPosts().then(setPosts).catch(() => {});
  }, []);

  useEffect(() => {
    refreshPosts();
    window.addEventListener(POSTS_CHANGED_EVENT, refreshPosts);
    return () => window.removeEventListener(POSTS_CHANGED_EVENT, refreshPosts);
  }, [refreshPosts]);

  useEffect(() => {
    if (!photoUrl) { setImage(null); return; }
    let active = true;
    loadImage(photoUrl).then((img) => { if (active) setImage(img); }).catch(() => toast('No se pudo abrir la foto. Intenta con otra.', 'error'));
    return () => { active = false; };
  }, [photoUrl, toast]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    let active = true;
    ensureFonts().then(() => {
      if (!active || !canvasRef.current) return;
      renderPost(canvasRef.current, {
        image, headline: template.headline, text: text.trim(), tag: template.tag,
        businessName: businessName.trim(), style, format,
      });
    });
    return () => { active = false; };
  }, [image, template, text, businessName, style, format]);

  const onPickFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Elige una foto (JPG o PNG).', 'error'); return; }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setTimeout(() => textRef.current?.focus(), 300);
  };

  const caption = buildCaption(template.headline, text.trim(), businessName.trim(), template.hashtags);
  const ready = !!image;

  const currentBlob = async () => {
    if (!canvasRef.current) throw new Error('Sin imagen');
    return canvasToBlob(canvasRef.current);
  };

  const fileName = () => `anuncio-${template.id}-${Date.now()}.jpg`;

  const handleDownload = async () => {
    try {
      downloadBlob(await currentBlob(), fileName());
      toast('Imagen guardada en tu teléfono', 'success');
    } catch { toast('No se pudo guardar la imagen', 'error'); }
  };

  const publishNow = async (post: ScheduledPost) => {
    const result = await sharePost(post.image, post.caption, fileName());
    if (result === 'cancelled') return;
    await markPublished(post);
    setJustPublished(post);
    toast(result === 'shared'
      ? '¡Listo! Tu anuncio se publicó.'
      : 'Imagen descargada y texto copiado. Pégalo en tu red social.', 'success');
  };

  const handleShareNow = async () => {
    setBusy(true);
    try {
      await requestNotificationPermission();
      const post: ScheduledPost = {
        id: crypto.randomUUID(), createdAt: Date.now(), scheduledAt: Date.now(), status: 'ready',
        image: await currentBlob(), caption, headline: template.headline,
      };
      await publishNow(post);
    } catch { toast('No se pudo compartir', 'error'); } finally { setBusy(false); }
  };

  const schedule = async (when: Date) => {
    if (when.getTime() < Date.now() + 60 * 1000) { toast('Elige una hora en el futuro', 'error'); return; }
    setBusy(true);
    try {
      const allowed = await requestNotificationPermission();
      await savePost({
        id: crypto.randomUUID(), createdAt: Date.now(), scheduledAt: when.getTime(), status: 'scheduled',
        image: await currentBlob(), caption, headline: template.headline,
      });
      setShowSchedule(false);
      toast(`Programado para ${formatWhen(when.getTime()).toLowerCase()}`, 'success');
      if (!allowed) toast('Activa las notificaciones para que te avisemos a tiempo', 'info');
      setTimeout(() => document.getElementById('mis-anuncios')?.scrollIntoView({ behavior: 'smooth' }), 200);
    } catch { toast('No se pudo programar el anuncio', 'error'); } finally { setBusy(false); }
  };

  const copyCaption = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast('Texto copiado', 'success'); } catch { toast('No se pudo copiar', 'error'); }
  };

  const ownerWaLink = (post: ScheduledPost) => {
    const digits = ownerWhatsapp.replace(/\D/g, '');
    if (!digits) return null;
    const phone = digits.length === 10 ? `52${digits}` : digits;
    const msg = `✅ Se publicó el anuncio "${post.headline}" (${formatWhen(post.publishedAt || Date.now())}).`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const suggestions = suggestTimes(3);
  const pending = posts.filter((p) => p.status !== 'published');
  const published = posts.filter((p) => p.status === 'published').slice(-5).reverse();

  return (
    <div className="studio min-h-screen bg-[#FBF8F3] pb-16 dark:bg-[#1C1612]">
      {/* Header */}
      <section className="border-b border-[#EFE4D3] bg-gradient-to-b from-[#F7F1E8] to-[#FBF8F3] px-4 py-8 text-center dark:border-[#3A2C22] dark:from-[#241B15] dark:to-[#1C1612]">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#B8892B]">Estudio de anuncios</p>
        <h1 className="font-display mt-2 text-3xl font-bold text-[#2A211B] sm:text-4xl dark:text-[#F7F1E8]">
          Tu anuncio listo en 2 pasos
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#7A6A5C] dark:text-[#C9B8A6]">
          Sube la foto de tu producto y escribe una frase. Nosotros le damos el diseño profesional.
        </p>
      </section>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 pt-6 lg:grid-cols-[1fr_1.05fr]">
        {/* Steps */}
        <div className="space-y-5">
          <StepCard n={1} title="Sube la foto de tu producto" done={ready}>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }} />
            {photoUrl ? (
              <div className="flex items-center gap-4">
                <img src={photoUrl} alt="Tu producto" className="h-24 w-24 rounded-2xl object-cover shadow" />
                <button onClick={() => fileRef.current?.click()} className="studio-btn-outline flex-1">
                  <RefreshCw className="h-5 w-5" /> Cambiar foto
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => cameraRef.current?.click()} className="studio-btn-primary min-h-[88px] flex-col text-base">
                  <Camera className="h-7 w-7" /> Tomar foto
                </button>
                <button onClick={() => fileRef.current?.click()} className="studio-btn-outline min-h-[88px] flex-col text-base">
                  <ImagePlus className="h-7 w-7" /> Elegir de mi galería
                </button>
              </div>
            )}
          </StepCard>

          <StepCard n={2} title="Escribe un texto corto" done={ready && text.trim().length > 0} disabled={!ready}>
            <textarea
              ref={textRef}
              value={text}
              maxLength={MAX_TEXT}
              rows={2}
              disabled={!ready}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej. Crepa de Nutella con fresas, $65"
              className="w-full resize-none rounded-2xl border-2 border-[#EFE4D3] bg-white px-4 py-3 text-lg text-[#2A211B] outline-none transition focus:border-[#B8892B] focus:ring-4 focus:ring-[#B8892B]/15 disabled:opacity-50 dark:border-[#3A2C22] dark:bg-[#241B15] dark:text-[#F7F1E8]"
            />
            <p className="mt-1 text-right text-xs text-[#7A6A5C]">{text.length}/{MAX_TEXT}</p>

            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[#5A3A22] dark:text-[#E6D5BF]">
              <Sparkles className="h-4 w-4 text-[#B8892B]" /> Frase promocional
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {POST_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  disabled={!ready}
                  onClick={() => { setTemplate(t); setTemplateTouched(true); }}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                    template.id === t.id
                      ? 'border-[#B8892B] bg-[#B8892B] text-white shadow'
                      : 'border-[#EFE4D3] bg-white text-[#5A3A22] hover:border-[#B8892B] dark:border-[#3A2C22] dark:bg-[#241B15] dark:text-[#E6D5BF]'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <p className="font-display mt-3 rounded-xl bg-[#F7F1E8] px-4 py-3 text-center text-lg italic text-[#5A3A22] dark:bg-[#2B2019] dark:text-[#E6D5BF]">
              “{template.headline}”
            </p>
          </StepCard>
        </div>

        {/* Preview + actions */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-3xl border border-[#EFE4D3] bg-white p-4 shadow-sm dark:border-[#3A2C22] dark:bg-[#241B15]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-[#2A211B] dark:text-[#F7F1E8]">Tu anuncio</h2>
              <div className="flex rounded-full bg-[#F7F1E8] p-1 dark:bg-[#2B2019]">
                {(Object.keys(FORMAT_SIZES) as PostFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${format === f ? 'bg-white text-[#5A3A22] shadow dark:bg-[#3A2C22] dark:text-[#F7F1E8]' : 'text-[#7A6A5C]'}`}
                  >
                    {FORMAT_SIZES[f].label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`mx-auto overflow-hidden rounded-2xl bg-[#F7F1E8] dark:bg-[#2B2019] ${format === 'story' ? 'max-w-[300px]' : 'max-w-[420px]'}`}>
              {ready ? (
                <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Vista previa del anuncio" />
              ) : (
                <div className={`flex flex-col items-center justify-center gap-2 p-6 text-center text-[#7A6A5C] ${format === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
                  <ImagePlus className="h-12 w-12 text-[#D4AF37]" />
                  <p className="text-sm">Aquí verás tu anuncio en cuanto subas la foto</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-3">
              {POST_STYLES.map((s) => (
                <button key={s.id} onClick={() => setStyle(s.id)} className="flex flex-col items-center gap-1" aria-pressed={style === s.id}>
                  <span
                    className={`block h-11 w-11 rounded-full border-4 transition ${style === s.id ? 'border-[#B8892B] scale-110' : 'border-transparent'}`}
                    style={{ background: `linear-gradient(135deg, ${s.swatch[0]} 50%, ${s.swatch[1]} 50%)`, boxShadow: '0 0 0 1px #E5D8C4' }}
                  />
                  <span className={`text-xs ${style === s.id ? 'font-semibold text-[#5A3A22] dark:text-[#F7F1E8]' : 'text-[#7A6A5C]'}`}>{s.label}</span>
                </button>
              ))}
            </div>

            <button onClick={() => setShowMore((v) => !v)} className="mx-auto mt-4 flex items-center gap-1 text-sm font-medium text-[#7A6A5C] hover:text-[#B8892B]">
              Más opciones <ChevronDown className={`h-4 w-4 transition ${showMore ? 'rotate-180' : ''}`} />
            </button>
            {showMore && (
              <div className="mt-3 space-y-3 rounded-2xl bg-[#FBF8F3] p-4 dark:bg-[#2B2019]">
                <label className="block text-sm font-medium text-[#5A3A22] dark:text-[#E6D5BF]">
                  Nombre de tu negocio
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={40} placeholder="Ej. Crepas La Esquina" className="studio-input mt-1" />
                </label>
                <label className="block text-sm font-medium text-[#5A3A22] dark:text-[#E6D5BF]">
                  WhatsApp del dueño (para avisarle al publicar)
                  <input value={ownerWhatsapp} onChange={(e) => setOwnerWhatsapp(e.target.value)} inputMode="tel" placeholder="10 dígitos" className="studio-input mt-1" />
                </label>
                <div>
                  <p className="text-sm font-medium text-[#5A3A22] dark:text-[#E6D5BF]">Texto para la publicación</p>
                  <p className="mt-1 whitespace-pre-line rounded-xl bg-white p-3 text-xs text-[#7A6A5C] dark:bg-[#241B15]">{caption}</p>
                  <button onClick={() => copyCaption(caption)} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#B8892B]"><Copy className="h-4 w-4" /> Copiar texto</button>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-3">
              <button disabled={!ready || busy} onClick={handleShareNow} className="studio-btn-primary min-h-[60px] text-lg">
                <Share2 className="h-6 w-6" /> Publicar ahora
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button disabled={!ready || busy} onClick={() => setShowSchedule((v) => !v)} className="studio-btn-outline min-h-[56px]">
                  <CalendarClock className="h-5 w-5" /> Programar
                </button>
                <button disabled={!ready || busy} onClick={handleDownload} className="studio-btn-outline min-h-[56px]">
                  <Download className="h-5 w-5" /> Guardar
                </button>
              </div>
            </div>

            {showSchedule && ready && (
              <div className="mt-4 rounded-2xl border-2 border-[#EFE4D3] p-4 dark:border-[#3A2C22]">
                <p className="flex items-center gap-1.5 text-sm font-bold text-[#5A3A22] dark:text-[#F7F1E8]">
                  <Clock className="h-4 w-4 text-[#B8892B]" /> Mejores horarios para tu negocio
                </p>
                <div className="mt-3 grid gap-2">
                  {suggestions.map((s) => (
                    <button key={s.date.getTime()} disabled={busy} onClick={() => schedule(s.date)} className="flex items-center justify-between rounded-xl border-2 border-[#EFE4D3] bg-white px-4 py-3 text-left transition hover:border-[#B8892B] dark:border-[#3A2C22] dark:bg-[#241B15]">
                      <span>
                        <span className="block font-semibold text-[#2A211B] dark:text-[#F7F1E8]">{formatWhen(s.date.getTime())}</span>
                        <span className="text-xs text-[#7A6A5C]">{s.reason}</span>
                      </span>
                      <span className="rounded-full bg-[#F7F1E8] px-3 py-1 text-xs font-semibold text-[#B8892B] dark:bg-[#2B2019]">Elegir</span>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs font-medium text-[#7A6A5C]">¿Otra hora?</p>
                <div className="mt-1 flex gap-2">
                  <input type="datetime-local" value={customWhen} min={toLocalInput(new Date())} onChange={(e) => setCustomWhen(e.target.value)} className="studio-input flex-1" />
                  <button disabled={!customWhen || busy} onClick={() => schedule(new Date(customWhen))} className="studio-btn-primary px-4">OK</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {justPublished && (
        <div className="mx-auto mt-6 max-w-5xl px-4">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center sm:flex-row sm:text-left dark:border-emerald-900 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-10 w-10 shrink-0 text-emerald-500" />
            <div className="flex-1">
              <p className="font-bold text-emerald-800 dark:text-emerald-300">¡Anuncio publicado!</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">“{justPublished.headline}”</p>
            </div>
            {ownerWaLink(justPublished) && (
              <a href={ownerWaLink(justPublished)!} target="_blank" rel="noreferrer" className="btn-wa min-h-[48px]">
                <MessageCircle className="h-5 w-5" /> Avisar al dueño
              </a>
            )}
            <button onClick={() => setJustPublished(null)} className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">Cerrar</button>
          </div>
        </div>
      )}

      {/* Scheduled posts */}
      <section id="mis-anuncios" className="mx-auto mt-10 max-w-5xl px-4">
        <h2 className="font-display text-2xl font-bold text-[#2A211B] dark:text-[#F7F1E8]">Mis anuncios programados</h2>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-[#7A6A5C]">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#B8892B]" />
          Te enviamos una notificación a la hora elegida; solo tocas “Publicar” y listo. Mantén la app instalada o abierta en este teléfono.
        </p>
        {pending.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-[#EFE4D3] p-8 text-center text-sm text-[#7A6A5C] dark:border-[#3A2C22]">
            Aún no tienes anuncios programados.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {pending.map((p) => (
              <PostRow key={p.id} post={p} onPublish={() => publishNow(p)} onDelete={() => deletePost(p.id)} onCopy={() => copyCaption(p.caption)} />
            ))}
          </div>
        )}
        {published.length > 0 && (
          <>
            <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-[#7A6A5C]">Publicados recientemente</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {published.map((p) => (
                <PostRow key={p.id} post={p} onDelete={() => deletePost(p.id)} onCopy={() => copyCaption(p.caption)} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StepCard({ n, title, done, disabled, children }: { n: number; title: string; done?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-3xl border border-[#EFE4D3] bg-white p-5 shadow-sm transition dark:border-[#3A2C22] dark:bg-[#241B15] ${disabled ? 'opacity-60' : ''}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-[#B8892B] text-white'}`}>
          {done ? <CheckCircle2 className="h-6 w-6" /> : n}
        </span>
        <h2 className="text-lg font-bold text-[#2A211B] dark:text-[#F7F1E8]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function PostRow({ post, onPublish, onDelete, onCopy }: { post: ScheduledPost; onPublish?: () => void; onDelete: () => void; onCopy: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(post.image);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [post.image]);

  const badge = post.status === 'ready'
    ? { text: '¡Listo para publicar!', cls: 'bg-[#B8892B] text-white animate-pulse' }
    : post.status === 'published'
    ? { text: 'Publicado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' }
    : { text: 'Programado', cls: 'bg-[#F7F1E8] text-[#5A3A22] dark:bg-[#2B2019] dark:text-[#E6D5BF]' };

  return (
    <div className="flex gap-4 rounded-2xl border border-[#EFE4D3] bg-white p-3 shadow-sm dark:border-[#3A2C22] dark:bg-[#241B15]">
      {thumb && <img src={thumb} alt="" className="h-28 w-24 shrink-0 rounded-xl object-cover" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
        <p className="mt-1 truncate font-semibold text-[#2A211B] dark:text-[#F7F1E8]">{post.headline}</p>
        <p className="text-xs text-[#7A6A5C]">
          {post.status === 'published' ? `Publicado: ${formatWhen(post.publishedAt || post.scheduledAt)}` : formatWhen(post.scheduledAt)}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-2">
          {onPublish && (
            <button onClick={onPublish} className="studio-btn-primary min-h-[44px] flex-1 px-3 text-sm">
              <Share2 className="h-4 w-4" /> Publicar
            </button>
          )}
          <button onClick={onCopy} className="rounded-xl p-2.5 text-[#7A6A5C] hover:bg-[#F7F1E8] dark:hover:bg-[#2B2019]" aria-label="Copiar texto"><Copy className="h-5 w-5" /></button>
          <button onClick={onDelete} className="rounded-xl p-2.5 text-[#7A6A5C] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" aria-label="Eliminar"><Trash2 className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
