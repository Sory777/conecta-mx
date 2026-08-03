import { useState, useEffect } from 'react';
import { QrCode, Globe, Info, Copy, Check, Share2, MessageCircle, Mail, Store, Briefcase, AlertTriangle, Edit3, Save } from 'lucide-react';
import { QRBox } from '../components/QRBox';
import { useToast } from '../components/Toast';

interface QRPageProps {
  onTrack: (key: 'qrDownloads') => void;
}

const URL_STORAGE_KEY = 'cmx_public_url';

function isPreviewUrl(url: string): boolean {
  return url.includes('bolt.new') || url.includes('localhost') || url.includes('127.0.0.1') || url.includes('.local') || url.includes('webcontainer');
}

export function QRPage({ onTrack }: QRPageProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const currentOrigin = `${window.location.origin}${window.location.pathname}`;

  useEffect(() => {
    const saved = localStorage.getItem(URL_STORAGE_KEY);
    if (saved) {
      setCustomUrl(saved);
    } else {
      setCustomUrl(currentOrigin);
    }
  }, [currentOrigin]);

  const publicUrl = customUrl || currentOrigin;
  const isPreview = isPreviewUrl(publicUrl);

  const saveUrl = () => {
    let url = urlInput.trim();
    if (!url) {
      toast('Ingresa una URL válida', 'error');
      return;
    }
    if (!url.startsWith('http')) url = `https://${url}`;
    if (url.endsWith('/')) url = url.slice(0, -1);
    localStorage.setItem(URL_STORAGE_KEY, url);
    setCustomUrl(url);
    setEditingUrl(false);
    toast('URL guardada. Los QR ahora apuntan a tu sitio público.', 'success');
  };

  const startEditing = () => {
    setUrlInput(publicUrl);
    setEditingUrl(true);
  };

  const shareData = {
    title: 'Conecta MX',
    text: 'Consigue más clientes. Mide tu inversión. Crece.',
    url: publicUrl,
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast('Enlace copiado al portapapeles', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('No se pudo copiar. Copia manualmente.', 'error');
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled
      }
    } else {
      copyLink();
    }
  };

  const waShare = `https://wa.me/?text=${encodeURIComponent(`¡Descubre Conecta MX! ${publicUrl}`)}`;
  const mailShare = `mailto:?subject=${encodeURIComponent('Conecta MX')}&body=${encodeURIComponent(`Consigue más clientes. Mide tu inversión. Crece.: ${publicUrl}`)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl mng-gradient text-white">
          <QrCode className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800">Comparte la app</h1>
        <p className="text-sm text-slate-500">Envía el enlace o muestra el QR a usuarios y negocios</p>
      </div>

      {/* Preview URL warning */}
      {isPreview && !editingUrl && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">Estás usando una URL de preview</p>
              <p className="mt-1 text-xs text-amber-700">
                La URL actual (<span className="break-all">{publicUrl}</span>) es temporal y no funciona
                cuando alguien la abre desde afuera de Bolt. Publica tu app (botón <strong>Publish</strong> arriba a la derecha)
                y luego ingresa aquí la URL pública que Bolt te dé (ej. <strong>mi-app.netlify.app</strong>).
              </p>
              <button onClick={startEditing} className="btn-outline mt-3 px-3 py-2 text-xs">
                <Edit3 className="h-4 w-4" /> Ingresar URL pública
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL editor */}
      {editingUrl && (
        <div className="mb-4 card p-4">
          <p className="mb-2 text-sm font-bold text-slate-700">URL pública de tu app</p>
          <p className="mb-3 text-xs text-slate-500">
            Ingresa la URL que Bolt te dio al publicar (ej. https://conecta-mx.netlify.app).
            Los QR y enlaces usarán esta dirección.
          </p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://tu-app.netlify.app"
              autoFocus
            />
            <button onClick={saveUrl} className="btn-primary px-4 py-2 text-sm">
              <Save className="h-4 w-4" /> Guardar
            </button>
            <button onClick={() => setEditingUrl(false)} className="btn-outline px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Current URL display */}
      {!editingUrl && !isPreview && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <Check className="h-4 w-4" /> URL pública: <span className="break-all font-medium">{publicUrl}</span>
          </div>
          <button onClick={startEditing} className="text-xs font-medium text-emerald-600 hover:underline">
            <Edit3 className="h-3.5 w-3.5" /> Cambiar
          </button>
        </div>
      )}

      {/* Direct link share */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
          <Share2 className="h-4 w-4 text-[#1565C0]" /> Enlace directo
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <input
            readOnly
            value={publicUrl}
            className="flex-1 bg-transparent text-sm text-slate-600 outline-none"
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={copyLink}
            className={`btn px-3 py-2 text-xs ${copied ? 'btn-primary' : 'btn-outline'}`}
          >
            {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button onClick={nativeShare} className="btn-outline px-3 py-2.5 text-xs">
            <Share2 className="h-4 w-4" /> Compartir
          </button>
          <a href={waShare} target="_blank" rel="noopener noreferrer" className="btn-wa px-3 py-2.5 text-xs">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a href={mailShare} className="btn-outline px-3 py-2.5 text-xs">
            <Mail className="h-4 w-4" /> Email
          </a>
          <button onClick={copyLink} className="btn-outline px-3 py-2.5 text-xs">
            <Copy className="h-4 w-4" /> Copiar
          </button>
        </div>
      </div>

      {/* QR code */}
      <div className="card mt-4 flex flex-col items-center gap-4 p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Globe className="h-4 w-4 text-[#1565C0]" /> Código QR general
        </div>
        <QRBox
          value={publicUrl}
          filename="conecta-mx-qr.png"
          label={publicUrl}
          onDownload={() => onTrack('qrDownloads')}
        />
        <p className="text-center text-sm text-slate-500">
          Imprime este QR y colócalo en tu mostrador, tarjetas de presentación o publicidad. Quien lo escanee llegará directamente a la app.
        </p>
      </div>

      {/* Audience cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Store className="h-4 w-4 text-emerald-600" /> Para negocios
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Comparte este enlace con negocios para que se registren gratis y empiecen a conseguir más clientes.
          </p>
          <a
            href={`${publicUrl}#/register`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline mt-3 w-full px-3 py-2 text-xs"
          >
            <Store className="h-4 w-4" /> Enlace para registrar negocio
          </a>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Briefcase className="h-4 w-4 text-amber-600" /> Para solicitantes
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Comparte este enlace con personas buscando empleo. Podrán ver vacantes y llenar su currículum dentro de la app.
          </p>
          <a
            href={`${publicUrl}#/jobs`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline mt-3 w-full px-3 py-2 text-xs"
          >
            <Briefcase className="h-4 w-4" /> Enlace para bolsa de empleo
          </a>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Códigos QR personalizados por negocio</p>
          <p className="mt-0.5 text-xs">
            El QR individual de cada negocio es un servicio aparte. El admin puede generarlo desde el panel de administración.
            Contáctanos: <strong>contacto@conectamx.app</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
