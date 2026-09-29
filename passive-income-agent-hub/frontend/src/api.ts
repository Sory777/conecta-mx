export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    if (data?.detail) {
      msg = Array.isArray(data.detail)
        ? data.detail.map((d: { loc?: string[]; msg: string }) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ')
        : String(data.detail);
    }
    if (res.status === 401 && !path.startsWith('/auth')) window.dispatchEvent(new Event('pih:unauthorized'));
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T,>(p: string) => request<T>('GET', p),
  post: <T,>(p: string, b: unknown = {}) => request<T>('POST', p, b),
  put: <T,>(p: string, b: unknown) => request<T>('PUT', p, b),
  patch: <T,>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T,>(p: string) => request<T>('DELETE', p),
};

// ---------- tipos
export type Status = 'ACTIVA' | 'EN_PRUEBA' | 'INVESTIGANDO' | 'REQUIERE_ACCION' | 'DESCARTADA';
export type Risk = 'BAJO' | 'MEDIO' | 'ALTO' | 'DESCARTAR';

export interface User {
  id: number;
  email: string;
  display_name: string;
  capital_limit_mxn: number;
  min_hourly_rate_mxn: number | null;
  investment_alert_threshold_mxn: number | null;
}

export interface Capital {
  limit_mxn: number;
  available_mxn: number;
  committed_mxn: number;
  invested_mxn: number;
  recovered_mxn: number;
  profit_mxn: number;
  loss_mxn: number;
  earned_mxn: number;
  operating_expenses_mxn: number;
  explanation: string;
}

export interface OpportunitySummary {
  id: number;
  title: string;
  category: string;
  description: string;
  status: Status;
  risk_level: Risk | null;
  automation_level: number | null;
  priority: number;
  platform_id: number | null;
  platform_name: string | null;
  platform_url: string | null;
  mexico_available: boolean | null;
  discovered_by: string;
  discovery_reason: string;
  discard_reason: string | null;
  metrics_status: string | null;
  initial_investment_mxn: number | null;
  gross_monthly_mxn: number | null;
  costs_monthly_mxn: number | null;
  net_monthly_mxn: number | null;
  net_monthly_low_mxn: number | null;
  net_monthly_high_mxn: number | null;
  hours_monthly: number | null;
  net_per_hour_mxn: number | null;
  confidence: string | null;
  observed_monthly_mxn: number | null;
  observed_days: number;
  created_at: string;
  dismissed_flags: { code: string; reason: string }[];
}

export interface Scenario {
  gross_mxn: number;
  costs: Record<string, number>;
  total_costs_mxn: number;
  net_mxn: number;
  hours: number;
  net_per_hour_mxn: number;
  initial_investment_mxn: number;
  roi_12m_pct: number | null;
  payback_months: number | null;
}

export interface Metrics {
  status: 'OK' | 'DATOS_INSUFICIENTES';
  missing?: string[];
  scenarios?: Record<'pesimista' | 'base' | 'optimista', Scenario>;
  calibrated_scenarios?: Record<'pesimista' | 'base' | 'optimista', Scenario>;
  confidence?: { score: number; label: string; reasons: string[] };
  assumptions?: string[];
  formulas?: Record<string, string>;
  inputs: { field: string; label: string; unit: string; mid_mxn: number; low_mxn: number; high_mxn: number; evidence_type: string; source_url: string | null; original: string | null }[];
  observed: null | {
    days: number; tasks: number; total_net_mxn: number; hours: number; net_per_hour_mxn: number | null;
    monthly_projection_mxn: number; monthly_interval_mxn: [number, number] | null; narrative: string;
  };
  calibration: null | { ratio: number; experiments: number; explanation: string };
  priority: { value: number; formula: string; explanation: string };
  narrative: string;
  warnings: string[];
  computed_at: string;
}

export interface Platform {
  id: number;
  name: string;
  url: string | null;
  domain: string | null;
  countries: string | null;
  mexico_available: boolean | null;
  payment_methods: string | null;
  min_payout: number | null;
  min_payout_currency: string | null;
  fees_note: string | null;
  requirements: string | null;
  tos_url: string | null;
  tos_prohibits_automation: boolean | null;
  has_official_api: boolean | null;
  api_docs_url: string | null;
  monitored_url: string | null;
  verification_status: string;
  domain_created_at: string | null;
  last_checked_at: string | null;
  notes: string | null;
}

export interface DataPoint {
  id: number; field: string; value: number; value_low: number | null; value_high: number | null; currency: string | null;
  evidence_type: string; source_url: string | null; source_name: string | null; retrieved_at: string | null;
  note: string | null; created_by: string; created_at: string;
}

export interface Flag { code: string; severity: string; detail: string; evidence: string; origin: string; dismissed?: boolean; dismissed_reason?: string }
export interface RiskAssessment { id: number; risk_level: Risk; flags: Flag[]; checks: { check: string; value: unknown }[]; reasoning: string; created_at: string }
export interface AutomationTask { id: number; description: string; method: string; allowed: boolean; policy_reason: string; status: string }
export interface Decision { id: number; agent_key: string; action: string; sections: Record<string, string | string[]>; created_at: string; opportunity_id: number | null; opportunity_title?: string | null }
export interface ResearchResult { id: number; url: string; title: string | null; source: string; content: string | null; page_age: string | null; retrieved_at: string; query: string | null; opportunity_id: number | null }
export interface PlatformChange { id: number; platform_id: number; url: string; change_type: string; summary: string; diff_excerpt: string | null; detected_at: string }

export interface OpportunityDetail {
  opportunity: OpportunitySummary;
  metrics: Metrics | null;
  platform: Platform | null;
  data_points: DataPoint[];
  risk_assessments: RiskAssessment[];
  automation_tasks: AutomationTask[];
  decisions: Decision[];
  research_results: ResearchResult[];
  experiments: Experiment[];
  platform_changes: PlatformChange[];
}

export interface ExperimentLog { id: number; day: string; minutes_used: number; tasks_available: number | null; tasks_completed: number | null; problems: string | null; blocked: boolean; notes: string | null }
export interface Experiment {
  id: number; opportunity_id: number; opportunity_title?: string; name: string; hypothesis: string; duration_days: number;
  target_net_mxn: number; budget_mxn: number; planned_hours: number | null; status: string; recommendation: string | null;
  started_at: string; finished_at: string | null; estimate_snapshot: Metrics | null;
  result: null | {
    actual_net_mxn: number; actual_net_after_investment_mxn: number; hours: number; actual_net_per_hour_mxn: number | null;
    estimated_period_net_mxn: Record<string, number> | null; estimated_net_per_hour_mxn: number | null;
    actual_vs_estimate_ratio: number | null; target_met: boolean; reasons: string[];
  };
  logs?: ExperimentLog[];
  totals?: Record<string, number | string[]>;
}

export interface Transaction {
  id: number; kind: 'ingreso' | 'gasto' | 'retiro'; occurred_on: string; amount: number; currency: string; fx_rate_to_mxn: number;
  fx_source: string; amount_mxn: number; description: string; opportunity_id: number | null; experiment_id: number | null;
  opportunity_title: string | null; detail: Record<string, unknown> | null;
}

export interface Alert { id: number; kind: string; severity: string; title: string; body: string; read: boolean; created_at: string; opportunity_id: number | null; platform_id: number | null }

export interface Meta {
  categories: string[]; statuses: Status[]; risks: Risk[]; evidence_types: string[]; currencies: string[];
  fields: { field: string; label: string; unit: string; monetary: boolean }[];
}
