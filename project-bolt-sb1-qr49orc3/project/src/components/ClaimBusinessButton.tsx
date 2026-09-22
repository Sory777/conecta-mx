import { useState } from 'react';
import { BadgeCheck, Send, X } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { storage } from '../lib/storage';

interface ClaimBusinessButtonProps {
  businessId: string;
  businessName: string;
}

export function ClaimBusinessButton({ businessId, businessName }: ClaimBusinessButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast('Nombre y correo son requeridos', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast('Correo inválido', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await storage.submitBusinessClaim(businessId, name.trim(), email.trim(), phone.trim() || undefined);
      setSent(true);
      toast('Solicitud enviada', 'success');
    } catch {
      toast('No se pudo enviar la solicitud. Intenta de nuevo.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setOpen(false);
    setSent(false);
    setName('');
    setEmail('');
    setPhone('');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-outline px-4 py-2 text-sm text-[#1565C0]"
      >
        <BadgeCheck className="h-4 w-4" /> ¿Es tu negocio? Reclámalo
      </button>
      <Modal open={open} onClose={close} title="Reclamar negocio" maxWidth="max-w-md">
        {sent ? (
          <div className="py-4 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-sm font-semibold text-slate-700">¡Solicitud enviada!</p>
            <p className="mt-1 text-sm text-slate-500">
              Revisaremos que seas el dueño de "{businessName}" y te contactaremos al correo que dejaste.
            </p>
            <button onClick={close} className="btn-primary mt-4 w-full text-sm">Cerrar</button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Confirma que eres el dueño o representante de <span className="font-semibold text-slate-700">{businessName}</span> para que puedas administrar su información, productos y promociones.
            </p>
            <div>
              <label className="label">Tu nombre</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <label className="label">Correo</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
            </div>
            <div>
              <label className="label">Teléfono (opcional)</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="4771234567" inputMode="numeric" />
            </div>
            <div className="flex gap-2">
              <button onClick={close} className="btn-outline flex-1 text-sm">
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button onClick={submit} disabled={submitting} className="btn-primary flex-1 text-sm">
                <Send className="h-4 w-4" /> {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
