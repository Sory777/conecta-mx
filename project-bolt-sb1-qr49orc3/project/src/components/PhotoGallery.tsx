import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadImage } from '../lib/upload';
import { useToast } from './Toast';

interface PhotoGalleryProps {
  photos: string[];
  limit: number;
  onChange: (photos: string[]) => Promise<void>;
}

export function PhotoGallery({ photos, limit, onChange }: PhotoGalleryProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (photos.length >= limit) {
      toast(`Tu plan permite hasta ${limit} fotos. Mejora tu plan para subir más.`, 'error');
      return;
    }
    setBusy(true);
    try {
      const url = await uploadImage(file, 'businesses');
      await onChange([...photos, url]);
      toast('Foto agregada', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo subir la foto';
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async (url: string) => {
    await onChange(photos.filter((p) => p !== url));
    toast('Foto eliminada', 'info');
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label">Fotos de tu espacio</label>
        <span className="text-xs font-medium text-slate-400">{photos.length}/{limit}</span>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} className="hidden" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((url) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(url)}
              className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-500"
              aria-label="Quitar foto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {photos.length < limit && (
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-[#1565C0] hover:text-[#1565C0]"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-xs font-medium">{busy ? 'Subiendo...' : 'Agregar'}</span>
          </button>
        )}
      </div>
      {photos.length >= limit && (
        <p className="mt-2 text-xs text-slate-400">Llegaste al límite de fotos de tu plan. Mejora tu plan para subir más.</p>
      )}
    </div>
  );
}
