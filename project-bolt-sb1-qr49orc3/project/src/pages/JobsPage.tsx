import { useMemo, useState, type FormEvent } from 'react';
import { Briefcase, Plus, X, Heart, Search, FileText } from 'lucide-react';
import type { Job, CV } from '../lib/types';
import { storage, uid } from '../lib/storage';
import { MUNICIPALITIES, CONTRACT_TYPES, CATEGORIES } from '../lib/constants';
import { JobCard } from '../components/JobCard';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { CVForm } from '../components/CVForm';
import { useToast } from '../components/Toast';

interface JobsPageProps {
  jobs: Job[];
  savedJobs: string[];
  onToggleSave: (id: string) => void;
  onChange: () => void;
}

export function JobsPage({ jobs, savedJobs, onToggleSave, onChange }: JobsPageProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [muni, setMuni] = useState('');
  const [category, setCategory] = useState('');
  const [contract, setContract] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [showOnlySaved, setShowOnlySaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCV, setShowCV] = useState(false);
  const [cvJob, setCvJob] = useState<Job | undefined>(undefined);

  const filtered = useMemo(() => {
    let list = jobs.slice();
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((j) =>
        j.title.toLowerCase().includes(q) ||
        j.companyName.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
      );
    }
    if (muni) list = list.filter((j) => j.municipality === muni);
    if (category) list = list.filter((j) => j.category === category);
    if (contract) list = list.filter((j) => j.contractType === contract);
    if (salaryMin) {
      const min = parseInt(salaryMin, 10);
      list = list.filter((j) => {
        const m = j.salary.match(/(\d[\d,]*)/);
        if (!m) return false;
        return parseInt(m[1].replace(/,/g, ''), 10) >= min;
      });
    }
    if (showOnlySaved) list = list.filter((j) => savedJobs.includes(j.id));
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }, [jobs, query, muni, category, contract, salaryMin, showOnlySaved, savedJobs]);

  const addJob = async (job: Omit<Job, 'id' | 'createdAt'>) => {
    const newJob: Job = { ...job, id: uid('job'), createdAt: Date.now() };
    await storage.addJob(newJob);
    onChange();
    setShowAdd(false);
    toast('Vacante publicada', 'success');
  };

  const openCV = (job: Job) => {
    setCvJob(job);
    setShowCV(true);
  };

  const submitCV = async (cv: Omit<CV, 'id' | 'createdAt'>) => {
    try {
      const full: CV = { ...cv, id: uid('cv'), createdAt: Date.now() };
      await storage.addCV(full);
      setShowCV(false);
      setCvJob(undefined);
      toast('¡Currículum enviado! La empresa se pondrá en contacto contigo.', 'success');
    } catch (err) {
      console.error('CV submit failed:', err);
      toast('No se pudo enviar el currículum. Intenta de nuevo.', 'error');
    }
  };

  const hasFilters = query || muni || category || contract || salaryMin || showOnlySaved;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Bolsa de Empleo</h1>
          <p className="text-sm text-slate-500">{filtered.length} vacantes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setCvJob(undefined); setShowCV(true); }} className="btn-outline text-sm">
            <FileText className="h-4 w-4" /> Mi CV
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Publicar vacante
          </button>
        </div>
      </div>

      <div className="card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por puesto o empresa..."
            className="input pl-9"
          />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select value={muni} onChange={(e) => setMuni(e.target.value)} className="input">
            <option value="">Todos los estados</option>
            {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <select value={contract} onChange={(e) => setContract(e.target.value)} className="input">
            <option value="">Todo tipo de contrato</option>
            {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value.replace(/\D/g, ''))}
            placeholder="Salario mínimo $"
            className="input"
            inputMode="numeric"
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={showOnlySaved}
              onChange={(e) => setShowOnlySaved(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#1565C0]"
            />
            <Heart className={`h-4 w-4 ${showOnlySaved ? 'fill-rose-500 text-rose-500' : ''}`} /> Solo guardadas ({savedJobs.length})
          </label>
          {hasFilters && (
            <button onClick={() => { setQuery(''); setMuni(''); setCategory(''); setContract(''); setSalaryMin(''); setShowOnlySaved(false); }} className="inline-flex items-center gap-1 text-xs font-medium text-[#1565C0] hover:underline">
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="mt-5">
        {filtered.length === 0 ? (
          <EmptyState
            title="No hay vacantes"
            message={showOnlySaved ? 'No tienes vacantes guardadas aún.' : 'No se encontraron vacantes con estos filtros.'}
            action={<button onClick={() => setShowAdd(true)} className="btn-primary mt-1 text-xs"><Plus className="h-4 w-4" /> Publicar vacante</button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((j) => (
              <JobCard key={j.id} job={j} saved={savedJobs.includes(j.id)} onToggleSave={onToggleSave} onApplyCV={openCV} />
            ))}
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Publicar vacante" maxWidth="max-w-xl">
        <AddJobForm onAdd={addJob} />
      </Modal>

      <Modal open={showCV} onClose={() => { setShowCV(false); setCvJob(undefined); }} title={cvJob ? 'Postular a vacante' : 'Mi currículum'} maxWidth="max-w-xl">
        <CVForm job={cvJob} onSubmit={submitCV} />
      </Modal>
    </div>
  );
}

function AddJobForm({ onAdd }: { onAdd: (j: Omit<Job, 'id' | 'createdAt'>) => void }) {
  const [f, setF] = useState({
    companyName: '', municipality: '', category: '', title: '', description: '', requirements: '',
    salary: '', contractType: CONTRACT_TYPES[0], contact: '', whatsapp: '', email: '',
  });
  const { toast } = useToast();
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.companyName.trim() || !f.municipality || !f.category || !f.title.trim() || !f.description.trim() || !f.contact.trim()) {
      toast('Completa los campos requeridos', 'error');
      return;
    }
    onAdd({
      companyName: f.companyName.trim(),
      municipality: f.municipality,
      category: f.category,
      title: f.title.trim(),
      description: f.description.trim(),
      requirements: f.requirements.trim(),
      salary: f.salary.trim() || 'No especificado',
      contractType: f.contractType,
      contact: f.contact.trim(),
      whatsapp: f.whatsapp.replace(/\D/g, '').slice(0, 10) || undefined,
      email: f.email.trim() || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Empresa *</label>
          <input className="input" value={f.companyName} onChange={(e) => set('companyName', e.target.value)} />
        </div>
        <div>
          <label className="label">Estado *</label>
          <select className="input" value={f.municipality} onChange={(e) => set('municipality', e.target.value)}>
            <option value="">Selecciona...</option>
            {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Categoría *</label>
        <select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>
          <option value="">Selecciona...</option>
          {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Puesto *</label>
        <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej. Mesero/a" />
      </div>
      <div>
        <label className="label">Descripción *</label>
        <textarea className="input min-h-[70px]" value={f.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div>
        <label className="label">Requisitos</label>
        <textarea className="input min-h-[60px]" value={f.requirements} onChange={(e) => set('requirements', e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Salario</label>
          <input className="input" value={f.salary} onChange={(e) => set('salary', e.target.value)} placeholder="$5,000 mensual" />
        </div>
        <div>
          <label className="label">Tipo de contrato</label>
          <select className="input" value={f.contractType} onChange={(e) => set('contractType', e.target.value)}>
            {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Contacto *</label>
        <input className="input" value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Nombre del responsable" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">WhatsApp (10 dígitos)</label>
          <input className="input" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="4771234567" inputMode="numeric" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="correo@empresa.mx" />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full"><Briefcase className="h-4 w-4" /> Publicar vacante</button>
    </form>
  );
}
