import type { CompetencyDTO } from '../../shared/types';
import { MasteryBadge } from './ui';

export function CompetencyTable({ competencies }: { competencies: CompetencyDTO[] }) {
  if (competencies.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <caption className="sr-only">Estado de dominio por competencia</caption>
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              Competencia
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {competencies.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2.5">
                <div className="font-medium text-slate-800">{c.name}</div>
                {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
              </td>
              <td className="px-3 py-2.5 text-right">
                <MasteryBadge state={c.state} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
