import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadImage } from '../lib/upload';
import { useToast } from './Toast';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  hint?: string;
  aspect?: string;
}

export function ImageUpload({ value, onChange, folder = 'businesses', label = 'Imagen', hint, aspect = 'aspect-video' }: ImageUploadProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
      toast('Imagen subida', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo subir la imagen';
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} className="hidden" />
      {value ? (
        <div className={`relative overflow-hidden rounded border border-line ${aspect}`}>
          <img src={value} alt="preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-2 rounded-full bg-ink/70 p-1 text-ink-invert transition hover:bg-rose-500"
            aria-label="Quitar imagen"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="absolute bottom-2 left-2 rounded bg-surface/90 px-2.5 py-1.5 text-xs font-medium shadow hover:bg-surface"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-line bg-surface-soft p-6 text-muted transition hover:border-gold hover:text-gold ${aspect}`}
        >
          {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7" />}
          <span className="text-sm font-medium">{busy ? 'Subiendo...' : 'Toca para subir una foto'}</span>
          {hint ? <span className="text-xs text-muted">{hint}</span> : <span className="text-xs text-muted">JPG, PNG, WebP · máx 4MB</span>}
        </button>
      )}
    </div>
  );
}
