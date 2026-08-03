import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { downloadDataUrl } from '../lib/utils';

interface QRBoxProps {
  value: string;
  size?: number;
  filename?: string;
  label?: string;
  onDownload?: () => void;
}

export function QRBox({ value, size = 200, filename = 'mng-qr.png', label, onDownload }: QRBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      value,
      { width: size, margin: 2, color: { dark: '#0D47A1', light: '#ffffff' } },
      (err) => {
        if (err) console.error(err);
        else if (canvasRef.current) setDataUrl(canvasRef.current.toDataURL('image/png'));
      }
    );
  }, [value, size]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl border-2 border-slate-100 bg-white p-3 shadow-sm">
        <canvas ref={canvasRef} width={size} height={size} />
      </div>
      {label && <p className="max-w-xs text-center text-xs text-slate-500 break-all">{label}</p>}
      {dataUrl && (
        <button
          onClick={() => { downloadDataUrl(dataUrl, filename); onDownload?.(); }}
          className="btn-outline px-4 py-2 text-xs"
        >
          <Download className="h-4 w-4" /> Descargar PNG
        </button>
      )}
    </div>
  );
}
