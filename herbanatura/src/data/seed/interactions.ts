import type { EvidenceLevel, Interaction, InteractionKind, LocalizedText } from '@/lib/domain/types';
import { cite, INSUFFICIENT, L, SEED_DATE } from './helpers';

/**
 * Severity is `not_graded` for every demo interaction: the cited fact sheets do
 * not grade severity, and HerbaNatura never invents a grade.
 */
const ix = (
  agent: string,
  medication: string,
  kind: InteractionKind,
  level: EvidenceLevel,
  effect: LocalizedText,
  sources: string[],
  mechanism?: LocalizedText,
): Interaction => ({
  id: `ix:${agent}>${medication}`,
  agentId: agent,
  medicationId: medication,
  kind,
  severity: 'not_graded',
  effect,
  mechanism: mechanism ?? null,
  level,
  citations: sources.map((s) => cite(s, 'Safety / Interactions')),
  reviewStatus: 'pending_review',
  reviewedAt: null,
  reviewedBy: null,
  updatedAt: SEED_DATE,
});

const SJW_MECH = L(
  'Pendiente de verificación con fuente específica (se describe inducción de enzimas que metabolizan fármacos).',
  'Pending verification with a specific source (induction of drug-metabolizing enzymes is described).',
);

export const INTERACTIONS: Interaction[] = [
  ix('plant:hiperico', 'medication:warfarina', 'documented', 'B', L('Puede reducir el efecto anticoagulante.', 'May weaken the anticoagulant effect.'), ['nccih-st-johns-wort'], SJW_MECH),
  ix('plant:hiperico', 'medication:anticonceptivos-orales', 'documented', 'B', L('Puede reducir la eficacia anticonceptiva.', 'May reduce contraceptive effectiveness.'), ['nccih-st-johns-wort'], SJW_MECH),
  ix('plant:hiperico', 'medication:ciclosporina', 'documented', 'B', L('Puede reducir los niveles y el efecto de la ciclosporina (riesgo de rechazo de trasplante).', 'May reduce cyclosporine levels and effect (risk of transplant rejection).'), ['nccih-st-johns-wort'], SJW_MECH),
  ix('plant:hiperico', 'medication:irinotecan', 'documented', 'B', L('Puede reducir el efecto de este fármaco oncológico.', 'May weaken the effect of this cancer drug.'), ['nccih-st-johns-wort'], SJW_MECH),
  ix('plant:hiperico', 'medication:digoxina', 'documented', 'B', L('Puede reducir el efecto de la digoxina.', 'May weaken the effect of digoxin.'), ['nccih-st-johns-wort'], SJW_MECH),
  ix('plant:hiperico', 'medication:saquinavir', 'documented', 'B', L('Puede reducir el efecto de medicamentos contra el VIH.', 'May weaken the effect of HIV medicines.'), ['nccih-st-johns-wort'], SJW_MECH),
  ix(
    'plant:hiperico',
    'medication:isrs',
    'documented',
    'B',
    L('Combinado con ciertos antidepresivos puede aumentar la serotonina de forma potencialmente peligrosa.', 'Combined with certain antidepressants it may cause a potentially dangerous increase in serotonin.'),
    ['nccih-st-johns-wort'],
  ),
  ix('plant:ajo', 'medication:saquinavir', 'documented', 'B', L('El ajo puede interferir con la eficacia del saquinavir.', 'Garlic may interfere with the effectiveness of saquinavir.'), ['nccih-garlic']),
  ix(
    'plant:ajo',
    'medication:warfarina',
    'possible',
    'X',
    L('Posible aumento del riesgo de sangrado (efecto antiagregante similar a la aspirina).', 'Possible increased bleeding risk (aspirin-like effect on clotting).'),
    ['nccih-garlic'],
  ),
  ix('plant:ajo', 'medication:aspirina', 'possible', 'X', L('Posible efecto aditivo sobre el sangrado.', 'Possible additive effect on bleeding.'), ['nccih-garlic']),
  ix('plant:te-verde', 'medication:nadolol', 'documented', 'C', L('El té verde puede reducir los niveles en sangre de nadolol.', 'Green tea may lower blood levels of nadolol.'), ['nccih-green-tea']),
  ix('plant:manzanilla', 'medication:warfarina', 'possible', 'X', L('Se han notificado interacciones; posible aumento del riesgo de sangrado.', 'Interactions have been reported; possible increased bleeding risk.'), ['nccih-chamomile']),
  ix('plant:manzanilla', 'medication:ciclosporina', 'possible', 'X', L('Se han notificado interacciones con ciclosporina.', 'Interactions with cyclosporine have been reported.'), ['nccih-chamomile']),
  ix('plant:ginkgo', 'medication:warfarina', 'possible', 'X', L('Posible aumento del riesgo de sangrado con anticoagulantes.', 'Possible increased bleeding risk with anticoagulants.'), ['nccih-ginkgo']),
  ix('plant:ginseng', 'medication:antidiabeticos', 'possible', 'C', L('Posible efecto aditivo de reducción de glucosa (riesgo de hipoglucemia).', 'Possible additive glucose-lowering effect (risk of low blood sugar).'), ['nccih-asian-ginseng']),
  ix('plant:hidrastis', 'medication:ciclosporina', 'possible', 'X', L('El hidrastis puede alterar el metabolismo de muchos medicamentos.', 'Goldenseal may alter the metabolism of many medicines.'), ['nccih-goldenseal']),
  ix('plant:curcuma', 'medication:warfarina', 'insufficient', 'X', INSUFFICIENT, ['nccih-turmeric']),
];
