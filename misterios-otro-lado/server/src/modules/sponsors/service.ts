import { z } from 'zod';
import type { Db } from '../../db/database';
import { clock } from '../../lib/clock';
import { newId } from '../../lib/ids';

/** Espacios patrocinables: carteles del mundo, pantalla de carga y banner del diario (nunca en mitad de la acción). */
export const SPONSOR_SLOTS = ['plaza_billboard', 'shop_sign', 'loading_screen', 'journal_banner'] as const;

export const CampaignSchema = z.object({
  sponsorName: z.string().min(1).max(60),
  slotId: z.enum(SPONSOR_SLOTS),
  headline: z.string().min(1).max(40),
  subline: z.string().max(60).default(''),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1d2b33'),
  fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f3e9d2'),
  startsAt: z.string(),
  endsAt: z.string(),
  active: z.boolean().default(true),
  /** Enlace del patrocinador (sólo https). Se abre fuera del juego y se cuentan los clics. */
  linkUrl: z.string().url().startsWith('https://').max(300).nullish(),
  /** Valor del contrato, para medir ingresos por patrocinio. */
  contractValueCents: z.number().int().min(0).max(1_000_000_000).default(0),
});

/** Patrocinios: espacios en el mundo (carteles, fachadas) que un admin asigna a campañas. */
export class SponsorService {
  constructor(private readonly db: Db) {}

  active() {
    const now = clock.now();
    const rows = this.db.all<{ id: string; slot_id: string; sponsor_name: string; headline: string; subline: string; bg_color: string; fg_color: string; link_url: string | null }>(
      'SELECT id, slot_id, sponsor_name, headline, subline, bg_color, fg_color, link_url FROM sponsor_campaigns WHERE active = 1 AND starts_at <= ? AND ends_at > ? ORDER BY created_at DESC',
      now,
      now,
    );
    const bySlot = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!bySlot.has(r.slot_id)) bySlot.set(r.slot_id, r);
    return [...bySlot.values()].map((r) => ({
      id: r.id,
      slot: r.slot_id,
      sponsor: r.sponsor_name,
      headline: r.headline,
      subline: r.subline,
      bg: r.bg_color,
      fg: r.fg_color,
      label: 'Patrocinado',
      link: r.link_url,
    }));
  }

  /** Impresión o clic, deduplicado por usuario y día (métrica fiable para cobrar al patrocinador). */
  event(campaignId: string, userId: string, type: 'impression' | 'click') {
    if (!this.db.get('SELECT 1 FROM sponsor_campaigns WHERE id = ?', campaignId)) return;
    const day = new Date(clock.now()).toISOString().slice(0, 10);
    const r = this.db.run('INSERT OR IGNORE INTO sponsor_events(campaign_id, user_id, type, day, created_at) VALUES (?, ?, ?, ?, ?)', campaignId, userId, type, day, clock.now());
    if (r.changes) this.db.run(`UPDATE sponsor_campaigns SET ${type === 'click' ? 'clicks = clicks + 1' : 'impressions = impressions + 1'} WHERE id = ?`, campaignId);
  }


  list() {
    return this.db.all('SELECT * FROM sponsor_campaigns ORDER BY created_at DESC');
  }

  upsert(input: z.infer<typeof CampaignSchema>, id?: string) {
    const s = Date.parse(input.startsAt);
    const e = Date.parse(input.endsAt);
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) throw new Error('Fechas inválidas');
    const cid = id ?? newId();
    this.db.run(
      `INSERT INTO sponsor_campaigns(id, sponsor_name, slot_id, headline, subline, bg_color, fg_color, starts_at, ends_at, active, created_at, link_url, contract_value_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET sponsor_name = excluded.sponsor_name, slot_id = excluded.slot_id, headline = excluded.headline,
       subline = excluded.subline, bg_color = excluded.bg_color, fg_color = excluded.fg_color, starts_at = excluded.starts_at,
       ends_at = excluded.ends_at, active = excluded.active, link_url = excluded.link_url, contract_value_cents = excluded.contract_value_cents`,
      cid,
      input.sponsorName,
      input.slotId,
      input.headline,
      input.subline,
      input.bgColor,
      input.fgColor,
      s,
      e,
      input.active ? 1 : 0,
      clock.now(),
      input.linkUrl ?? null,
      input.contractValueCents,
    );
    return { id: cid };
  }
}
