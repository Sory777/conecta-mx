import { adminAccess } from '@/lib/admin/guard';
import { sessionClient } from '@/lib/supabase/clients';
import { Notice } from '@/components/ui';

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ tabla?: string }> }) {
  const access = await adminAccess();
  const { tabla } = await searchParams;
  if (access.kind !== 'staff') return <Notice>El historial de cambios requiere Supabase y rol de administrador.</Notice>;
  const db = await sessionClient();
  let q = db.from('audit_logs').select('id, table_name, row_id, action, actor_id, created_at, new_data, old_data').order('created_at', { ascending: false }).limit(200);
  if (tabla && /^[a-z_]{1,40}$/.test(tabla)) q = q.eq('table_name', tabla);
  const [{ data: logs, error }, { data: reviews }, { data: people }] = await Promise.all([
    q,
    db.from('content_reviews').select('id, target_table, target_id, decision, notes, reviewer_id, created_at').order('created_at', { ascending: false }).limit(100),
    db.from('profiles').select('id, display_name'),
  ]);
  if (error) return <Notice tone="danger">Sólo administradores pueden ver la auditoría ({error.message}).</Notice>;
  const who = (id: string | null) => (id ? (people ?? []).find((p) => p.id === id)?.display_name ?? id.slice(0, 8) : 'sistema');
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Decisiones de revisión</h2>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-muted"><th>Fecha</th><th>Tabla</th><th>Decisión</th><th>Revisor</th><th>Notas</th></tr></thead>
          <tbody>{(reviews ?? []).map((r) => <tr key={r.id} className="border-t border-border"><td className="py-1">{String(r.created_at).slice(0, 16)}</td><td>{r.target_table}</td><td>{r.decision}</td><td>{who(r.reviewer_id)}</td><td>{r.notes}</td></tr>)}</tbody>
        </table>
      </section>
      <section>
        <h2 className="font-serif text-2xl font-semibold">Historial de cambios</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(logs ?? []).map((l) => (
            <li key={l.id} className="rounded-xl border border-border bg-surface p-3">
              <p><span className="font-mono text-xs">{String(l.created_at).slice(0, 19)}</span> · <strong>{l.action}</strong> {l.table_name} · {who(l.actor_id)}</p>
              <details className="mt-1"><summary className="cursor-pointer text-xs text-muted">Ver datos</summary><pre className="mt-1 max-h-64 overflow-auto rounded bg-surface-2 p-2 text-xs">{JSON.stringify({ antes: l.old_data, despues: l.new_data }, null, 2)}</pre></details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
