import 'server-only';

/** ClinicalTrials.gov API v2 (public domain registry data). */
export interface TrialRecord {
  nctId: string;
  title: string;
  status: string | null;
  phases: string[];
  studyType: string | null;
  conditions: string[];
  interventions: string[];
  countries: string[];
  startDate: string | null;
  url: string;
}

type Raw = {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string; startDateStruct?: { date?: string } };
    designModule?: { studyType?: string; phases?: string[] };
    conditionsModule?: { conditions?: string[] };
    armsInterventionsModule?: { interventions?: { name?: string }[] };
    contactsLocationsModule?: { locations?: { country?: string }[] };
  };
};

export async function searchTrials(opts: { condition?: string; intervention?: string; term?: string; country?: string; status?: string; pageSize?: number }) {
  const p = new URLSearchParams({ format: 'json', pageSize: String(Math.min(opts.pageSize ?? 20, 50)), countTotal: 'true' });
  if (opts.condition) p.set('query.cond', opts.condition);
  if (opts.intervention) p.set('query.intr', opts.intervention);
  if (opts.term) p.set('query.term', opts.term);
  if (opts.country) p.set('query.locn', opts.country);
  if (opts.status) p.set('filter.overallStatus', opts.status);
  const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${p}`, { next: { revalidate: 60 * 60 * 24 }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`clinicaltrials ${res.status}`);
  const data = (await res.json()) as { totalCount?: number; studies?: Raw[] };
  const records: TrialRecord[] = (data.studies ?? []).flatMap((s) => {
    const ps = s.protocolSection;
    const nctId = ps?.identificationModule?.nctId;
    if (!nctId || !/^NCT\d{8}$/.test(nctId)) return [];
    return [{
      nctId,
      title: ps?.identificationModule?.briefTitle ?? '',
      status: ps?.statusModule?.overallStatus ?? null,
      phases: ps?.designModule?.phases ?? [],
      studyType: ps?.designModule?.studyType ?? null,
      conditions: ps?.conditionsModule?.conditions ?? [],
      interventions: (ps?.armsInterventionsModule?.interventions ?? []).map((i) => i.name ?? '').filter(Boolean),
      countries: [...new Set((ps?.contactsLocationsModule?.locations ?? []).map((l) => l.country ?? '').filter(Boolean))],
      startDate: ps?.statusModule?.startDateStruct?.date ?? null,
      url: `https://clinicaltrials.gov/study/${nctId}`,
    }];
  });
  return { total: data.totalCount ?? records.length, records };
}
