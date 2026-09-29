import { Trash2 } from 'lucide-react';
import { api, Transaction } from '../api';
import TransactionForm from '../components/TransactionForm';
import { Empty, ErrorBox, mxn, Section, useAsync } from '../components/ui';

export default function Finance() {
  const { data, error, reload } = useAsync(() => api.get<Transaction[]>('/transactions'));
  const remove = async (id: number) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    await api.del(`/transactions/${id}`);
    reload();
  };
  const setWithdrawal = async (id: number, status: string) => {
    await api.patch(`/transactions/withdrawals/${id}`, { status });
    reload();
  };
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Ingresos y gastos</h1>
        <p className="text-sm text-slate-400">
          Los montos en otras monedas se convierten a MXN con la tasa del momento (se guarda la fuente). Un ingreso queda PENDIENTE
          hasta que un retiro RECIBIDO lo confirma.
        </p>
      </header>
      <Section title="Registrar movimiento"><TransactionForm onDone={reload} /></Section>
      <ErrorBox error={error} />
      {data && data.length === 0 && <Empty>Sin movimientos.</Empty>}
      {data && data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-slate-800"><tr>{['Fecha', 'Tipo', 'Oportunidad', 'Monto', 'MXN', 'Tasa / fuente', 'Detalle', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {data.map((t) => {
                const d = t.detail || {};
                return (
                  <tr key={t.id} className="border-t border-slate-800/70">
                    <td className="td">{t.occurred_on}</td>
                    <td className={`td font-medium ${t.kind === 'ingreso' ? 'text-emerald-300' : t.kind === 'gasto' ? 'text-rose-300' : 'text-sky-300'}`}>{t.kind}</td>
                    <td className="td text-xs">{t.opportunity_title ?? '—'}</td>
                    <td className="td">{t.amount} {t.currency}</td>
                    <td className="td">{mxn(t.amount_mxn)}</td>
                    <td className="td text-[11px] text-slate-500">{t.currency !== 'MXN' ? `${t.fx_rate_to_mxn} · ${t.fx_source}` : '—'}</td>
                    <td className="td text-xs text-slate-400">
                      {t.kind === 'ingreso' && String(d.status)}
                      {t.kind === 'gasto' && `${d.category}${d.is_investment ? ' · inversión' : ''}`}
                      {t.kind === 'retiro' && (
                        <select className="input w-auto py-0.5 text-xs" value={String(d.status)} onChange={(e) => setWithdrawal(t.id, e.target.value)}>
                          <option>SOLICITADO</option><option>RECIBIDO</option><option>RECHAZADO</option>
                        </select>
                      )}
                      {t.description && <div>{t.description}</div>}
                    </td>
                    <td className="td"><button className="text-slate-500 hover:text-rose-400" onClick={() => remove(t.id)}><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
