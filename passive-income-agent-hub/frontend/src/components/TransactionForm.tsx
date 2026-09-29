import { FormEvent, useState } from 'react';
import { api, OpportunitySummary } from '../api';
import { ErrorBox, Field, useAsync, useMeta } from './ui';

const today = () => new Date().toLocaleDateString('en-CA');

export default function TransactionForm({ experimentId, onDone }: { experimentId?: number; onDone: () => void }) {
  const meta = useMeta();
  const opps = useAsync(() => (experimentId ? Promise.resolve([] as OpportunitySummary[]) : api.get<OpportunitySummary[]>('/opportunities?sort=recent')), [experimentId]);
  const [kind, setKind] = useState<'earnings' | 'expenses' | 'withdrawals'>('earnings');
  const [f, setF] = useState({
    amount: '', currency: 'MXN', manual_rate: '', occurred_on: today(), opportunity_id: '', description: '',
    status: 'PENDIENTE', tasks_count: '', category: 'otro', is_investment: false, method: '', wstatus: 'SOLICITADO', fee_mxn: '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const base: Record<string, unknown> = {
      amount: Number(f.amount), currency: f.currency, manual_rate: f.manual_rate ? Number(f.manual_rate) : null,
      occurred_on: f.occurred_on, description: f.description,
      opportunity_id: f.opportunity_id ? Number(f.opportunity_id) : null, experiment_id: experimentId ?? null,
    };
    if (kind === 'earnings') Object.assign(base, { status: f.status, tasks_count: f.tasks_count ? Number(f.tasks_count) : null });
    if (kind === 'expenses') Object.assign(base, { category: f.category, is_investment: f.is_investment });
    if (kind === 'withdrawals') Object.assign(base, { method: f.method, status: f.wstatus, fee_mxn: f.fee_mxn ? Number(f.fee_mxn) : 0 });
    try {
      await api.post(`/transactions/${kind}`, base);
      setF({ ...f, amount: '', description: '', tasks_count: '', fee_mxn: '', manual_rate: '' });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-1">
        {([['earnings', 'Ingreso'], ['expenses', 'Gasto'], ['withdrawals', 'Retiro']] as const).map(([k, l]) => (
          <button type="button" key={k} onClick={() => setKind(k)}
            className={`btn ${kind === k ? 'bg-slate-700 text-white' : 'border border-slate-700 text-slate-400'}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Monto"><input className="input" required type="number" min="0" step="any" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Moneda">
          <select className="input" value={f.currency} onChange={set('currency')}>{meta?.currencies.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        {f.currency !== 'MXN' && (
          <Field label="Tasa manual a MXN (opcional)"><input className="input" type="number" step="any" placeholder="automática" value={f.manual_rate} onChange={set('manual_rate')} /></Field>
        )}
        <Field label="Fecha"><input className="input" type="date" value={f.occurred_on} onChange={set('occurred_on')} /></Field>
        {!experimentId && (
          <Field label="Oportunidad">
            <select className="input" value={f.opportunity_id} onChange={set('opportunity_id')}>
              <option value="">(ninguna)</option>
              {opps.data?.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </Field>
        )}
        {kind === 'earnings' && (<>
          <Field label="Estado">
            <select className="input" value={f.status} onChange={set('status')}>
              <option value="PENDIENTE">Pendiente (saldo en plataforma)</option><option value="CONFIRMADO">Confirmado (dinero recibido)</option>
            </select>
          </Field>
          <Field label="Tareas (opcional)"><input className="input" type="number" min="0" value={f.tasks_count} onChange={set('tasks_count')} /></Field>
        </>)}
        {kind === 'expenses' && (<>
          <Field label="Categoría">
            <select className="input" value={f.category} onChange={set('category')}>
              {['electricidad', 'comisiones', 'suscripcion', 'hardware', 'mantenimiento', 'otro'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 pt-5 text-sm text-slate-300">
            <input type="checkbox" checked={f.is_investment} onChange={(e) => setF({ ...f, is_investment: e.target.checked })} />
            Es inversión inicial (cuenta contra el capital)
          </label>
        </>)}
        {kind === 'withdrawals' && (<>
          <Field label="Método"><input className="input" value={f.method} onChange={set('method')} placeholder="PayPal, transferencia…" /></Field>
          <Field label="Estado">
            <select className="input" value={f.wstatus} onChange={set('wstatus')}>
              <option>SOLICITADO</option><option>RECIBIDO</option><option>RECHAZADO</option>
            </select>
          </Field>
          <Field label="Comisión del retiro (MXN)"><input className="input" type="number" min="0" step="any" value={f.fee_mxn} onChange={set('fee_mxn')} /></Field>
        </>)}
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Descripción"><input className="input" value={f.description} onChange={set('description')} /></Field></div>
      </div>
      <button className="btn-primary">Registrar</button>
      <ErrorBox error={error} />
    </form>
  );
}
