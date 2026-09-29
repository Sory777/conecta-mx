import { useRef, useState } from 'react';
import { BadgeCheck, Send, X, LogIn, Upload, Loader2, Check } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { storage } from '../lib/storage';
import { uploadClaimDocument } from '../lib/upload';
import { useAuth } from '../lib/auth';

interface ClaimBusinessButtonProps {
  businessId: string;
  businessName: string;
}

function DocumentPicker({
  label, hint, required, path, onChange,
}: {
  label: string;
  hint: string;
  required?: boolean;
  path: string;
  onChange: (path: string) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setBusy(true);
    try {
      const uploadedPath = await uploadClaimDocument(file);
      onChange(uploadedPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo subir el documento';
      toast(msg, 'error');
      setPreviewUrl('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="label">{label}{required ? '' : ' (opcional, recomendado)'}</label>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-3 text-left transition ${path ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:border-[#9C6F0A]'}`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Upload className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700">
            {busy ? 'Subiendo...' : path ? 'Listo, toca para cambiarla' : 'Toca para subir una foto'}
          </p>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" /> : path ? <Check className="h-4 w-4 shrink-0 text-emerald-500" /> : null}
      </button>
    </div>
  );
}

export function ClaimBusinessButton({ businessId, businessName }: ClaimBusinessButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [idPhotoPath, setIdPhotoPath] = useState('');
  const [proofPhotoPath, setProofPhotoPath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast('Tu nombre es requerido', 'error');
      return;
    }
    if (!idPhotoPath) {
      toast('Sube una foto de tu identificación para verificarte', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await storage.submitBusinessClaim(businessId, name.trim(), user.email || '', user.id, phone.trim() || undefined, idPhotoPath, proofPhotoPath || undefined);
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
    setPhone('');
    setIdPhotoPath('');
    setProofPhotoPath('');
  };

  // Requiring a signed-in account (instead of a free-text name/email form
  // anyone could fill out) means the email on the claim is genuinely
  // theirs, and approving it can safely link their real account to the
  // business — which a free-text form never let us do.
  if (!user) {
    return (
      <a href="#/login" className="btn-outline px-4 py-2 text-sm text-[#9C6F0A]">
        <LogIn className="h-4 w-4" /> ¿Es tu negocio? Inicia sesión para reclamarlo
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-outline px-4 py-2 text-sm text-[#9C6F0A]"
      >
        <BadgeCheck className="h-4 w-4" /> ¿Es tu negocio? Reclámalo
      </button>
      <Modal open={open} onClose={close} title="Reclamar negocio" maxWidth="max-w-md">
        {sent ? (
          <div className="py-4 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-sm font-semibold text-slate-700">¡Solicitud enviada!</p>
            <p className="mt-1 text-sm text-slate-500">
              Revisaremos tus documentos y te contactaremos al correo de tu cuenta.
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
              <label className="label">Correo de tu cuenta</label>
              <input className="input bg-slate-50 text-slate-500" value={user.email || ''} disabled readOnly />
            </div>
            <div>
              <label className="label">Teléfono (opcional)</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="4771234567" inputMode="numeric" />
            </div>
            <DocumentPicker
              label="Foto de tu identificación"
              hint="INE, licencia u otra identificación oficial"
              required
              path={idPhotoPath}
              onChange={setIdPhotoPath}
            />
            <DocumentPicker
              label="Comprobante de que el negocio es tuyo"
              hint="Recibo, factura, o una foto tuya frente al negocio con el letrero visible"
              path={proofPhotoPath}
              onChange={setProofPhotoPath}
            />
            <p className="text-xs text-slate-400">
              Estos documentos solo los puede ver un administrador para verificarte, y no se muestran públicamente.
            </p>
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
