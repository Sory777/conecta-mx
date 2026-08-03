import { useState, type FormEvent } from 'react';
import { FileText, Send } from 'lucide-react';
import type { Job } from '../lib/types';
import { MUNICIPALITIES } from '../lib/constants';
import { useToast } from './Toast';

interface CVFormProps {
  job?: Job;
  onSubmit: (cv: Omit<CV, 'id' | 'createdAt'>) => void;
}

import type { CV } from '../lib/types';

export function CVForm({ job, onSubmit }: CVFormProps) {
  const { toast } = useToast();
  const [f, setF] = useState({
    fullName: '',
    email: '',
    phone: '',
    municipality: job?.municipality || '',
    position: job?.title || '',
    experience: '',
    education: '',
    skills: '',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.fullName.trim() || !f.email.trim() || !f.phone.trim() || !f.municipality || !f.position.trim()) {
      toast('Completa los campos requeridos', 'error');
      return;
    }
    onSubmit({
      ...f,
      jobId: job?.id,
      companyName: job?.companyName,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-xl bg-[#1565C0]/5 px-3 py-2.5 text-xs text-slate-600">
        <FileText className="mr-1 inline h-3.5 w-3.5 text-[#1565C0]" />
        {job ? (
          <>Postulando para <strong>{job.title}</strong> en {job.companyName}</>
        ) : (
          <>Llena tu currículum para que las empresas te encuentren</>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nombre completo *</label>
          <input className="input" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Juan Pérez García" />
        </div>
        <div>
          <label className="label">Teléfono *</label>
          <input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="4771234567" inputMode="numeric" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="juan@email.com" />
        </div>
        <div>
          <label className="label">Municipio *</label>
          <select className="input" value={f.municipality} onChange={(e) => set('municipality', e.target.value)}>
            <option value="">Selecciona...</option>
            {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Puesto que buscas *</label>
        <input className="input" value={f.position} onChange={(e) => set('position', e.target.value)} placeholder="Ej. Mesero, Cocinero, Vendedor..." />
      </div>

      <div>
        <label className="label">Experiencia laboral</label>
        <textarea className="input min-h-[80px]" value={f.experience} onChange={(e) => set('experience', e.target.value)} placeholder="Ej. 2 años como mesero en restaurante, atención al cliente, manejo de caja..." />
      </div>

      <div>
        <label className="label">Educación</label>
        <input className="input" value={f.education} onChange={(e) => set('education', e.target.value)} placeholder="Ej. Bachillerato, Carrera técnica en..." />
      </div>

      <div>
        <label className="label">Habilidades</label>
        <input className="input" value={f.skills} onChange={(e) => set('skills', e.target.value)} placeholder="Ej. Trabajo en equipo, Excel, manejo de inventario..." />
      </div>

      <button type="submit" className="btn-primary w-full">
        <Send className="h-4 w-4" /> Enviar currículum
      </button>
    </form>
  );
}
