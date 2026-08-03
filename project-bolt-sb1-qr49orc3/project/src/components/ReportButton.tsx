import { useState } from 'react';
import { Flag, X, Send } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { storage } from '../lib/storage';
import { REPORT_REASONS } from '../lib/constants';
import type { ReportReason } from '../lib/types';

interface ReportButtonProps {
  itemType: 'business' | 'product' | 'event' | 'job' | 'review';
  itemId: string;
}

export function ReportButton({ itemType, itemId }: ReportButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) {
      toast('Selecciona un motivo', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await storage.submitReport(itemType, itemId, reason as ReportReason, details.trim() || undefined);
      toast('Reporte enviado. Lo revisaremos pronto.', 'success');
      setOpen(false);
      setReason('');
      setDetails('');
    } catch {
      toast('No se pudo enviar el reporte. Intenta de nuevo.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
        aria-label="Reportar"
      >
        <Flag className="h-3.5 w-3.5" /> Reportar
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Reportar contenido" maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Ayúdanos a mantener Conecta MX seguro. Reporta si este contenido es:</p>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r.value as ReportReason)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                  reason === r.value ? 'border-[#1565C0] bg-blue-50 text-[#0D47A1]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${reason === r.value ? 'border-[#1565C0] bg-[#1565C0]' : 'border-slate-300'}`}>
                  {reason === r.value && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                {r.label}
              </button>
            ))}
          </div>
          <div>
            <label className="label">Detalles (opcional)</label>
            <textarea
              className="input min-h-[70px]"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Cuéntanos qué pasó..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="btn-outline flex-1 text-sm">
              <X className="h-4 w-4" /> Cancelar
            </button>
            <button onClick={submit} disabled={submitting} className="btn-primary flex-1 text-sm">
              <Send className="h-4 w-4" /> {submitting ? 'Enviando...' : 'Enviar reporte'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
