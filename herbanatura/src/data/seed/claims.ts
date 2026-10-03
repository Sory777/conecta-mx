import type { ClaimContext, EvidenceCategory, EvidenceClaim, EvidenceLevel, LocalizedText, StudyType } from '@/lib/domain/types';
import { cite, L, SEED_DATE } from './helpers';

type ClaimInput = {
  id: string;
  subject: string;
  condition?: string;
  context: ClaimContext;
  level: EvidenceLevel;
  category: EvidenceCategory;
  studyTypes: StudyType[];
  humanEvidence: boolean;
  statement: LocalizedText;
  simple: LocalizedText;
  know?: LocalizedText[];
  dontKnow?: LocalizedText[];
  investigating?: LocalizedText[];
  risks?: LocalizedText[];
  limitations?: LocalizedText[];
  sources: [string, string?][];
};

const claim = (c: ClaimInput): EvidenceClaim => ({
  id: `claim:${c.id}`,
  subjectId: c.subject,
  conditionId: c.condition ?? null,
  context: c.context,
  level: c.level,
  category: c.category,
  studyTypes: c.studyTypes,
  humanEvidence: c.humanEvidence,
  statement: c.statement,
  simple: c.simple,
  whatWeKnow: c.know ?? [],
  whatWeDontKnow: c.dontKnow ?? [],
  underInvestigation: c.investigating ?? [],
  risks: c.risks ?? [],
  limitations: c.limitations ?? [],
  researchDoses: null,
  studyIds: [],
  citations: c.sources.map(([id, loc]) => cite(id, loc)),
  reviewStatus: 'pending_review',
  reviewedAt: null,
  reviewedBy: null,
  updatedAt: SEED_DATE,
});

const NOT_A_TREATMENT = L(
  'Ningún resultado de laboratorio o en animales justifica sustituir, retrasar o abandonar un tratamiento oncológico.',
  'No laboratory or animal result justifies replacing, delaying or abandoning cancer treatment.',
);

const CHECK_TRIALS = L(
  'Pueden existir ensayos clínicos registrados; consúltelos en el modo Investigación (ClinicalTrials.gov).',
  'Registered clinical trials may exist; check them in Research mode (ClinicalTrials.gov).',
);

export const CLAIMS: EvidenceClaim[] = [
  /* ---------------------------------------------------- cúrcuma / curcumina */
  claim({
    id: 'curcumina-colorrectal-investigacion',
    subject: 'compound:curcumina',
    condition: 'condition:cancer-colorrectal',
    context: 'research',
    level: 'E',
    category: 'preclinical',
    studyTypes: ['in_vitro', 'animal'],
    humanEvidence: false,
    statement: L(
      'La curcumina se ha estudiado ampliamente en cultivos celulares y modelos animales de cáncer colorrectal. Estos resultados experimentales no demuestran eficacia en personas.',
      'Curcumin has been studied extensively in cell cultures and animal models of colorectal cancer. These experimental results do not demonstrate efficacy in people.',
    ),
    simple: L(
      'La curcumina es una sustancia presente en la cúrcuma. Los científicos la han estudiado en diferentes tipos de cáncer, pero los resultados obtenidos en laboratorio no significan automáticamente que consumir cúrcuma pueda tratar un cáncer en una persona.',
      'Curcumin is a substance found in turmeric. Scientists have studied it in different types of cancer, but laboratory results do not automatically mean that eating turmeric can treat cancer in a person.',
    ),
    know: [
      L('Existe una gran cantidad de estudios de laboratorio y en animales.', 'There is a large body of laboratory and animal studies.'),
      L('Hay poca evidencia clínica fiable sobre la cúrcuma para cualquier condición.', 'There is little reliable clinical evidence on turmeric for any condition.'),
    ],
    dontKnow: [
      L('Si la curcumina mejora algún resultado clínico en personas con cáncer colorrectal.', 'Whether curcumin improves any clinical outcome in people with colorectal cancer.'),
      L('Qué dosis o formulación serían relevantes y seguras en este contexto.', 'Which dose or formulation would be relevant and safe in this context.'),
    ],
    investigating: [CHECK_TRIALS],
    risks: [L('Casos notificados de daño hepático con suplementos.', 'Reported cases of liver injury with supplements.')],
    limitations: [L('Los efectos en células y animales con frecuencia no se reproducen en humanos.', 'Effects in cells and animals often do not replicate in humans.')],
    sources: [['nccih-turmeric'], ['nci-cam'], ['clinicaltrials']],
  }),
  claim({
    id: 'curcumina-colorrectal-tratamiento',
    subject: 'compound:curcumina',
    condition: 'condition:cancer-colorrectal',
    context: 'cancer_treatment',
    level: 'X',
    category: 'insufficient',
    studyTypes: ['in_vitro', 'animal'],
    humanEvidence: false,
    statement: L(
      'La curcumina NO ha demostrado tratar el cáncer colorrectal en humanos.',
      'Curcumin has NOT been shown to treat colorectal cancer in humans.',
    ),
    simple: L(
      'No hay pruebas de que la cúrcuma o la curcumina curen el cáncer de colon. No sustituye al tratamiento médico.',
      'There is no proof that turmeric or curcumin cure colon cancer. It does not replace medical treatment.',
    ),
    know: [NOT_A_TREATMENT],
    risks: [
      L('Posibles interacciones con tratamientos oncológicos: información insuficiente; consulte a su oncólogo antes de tomar suplementos.', 'Possible interactions with cancer treatments: insufficient information; ask your oncologist before taking supplements.'),
    ],
    sources: [['nccih-turmeric'], ['nci-cam']],
  }),
  claim({
    id: 'curcuma-inflamacion',
    subject: 'plant:curcuma',
    condition: 'condition:inflamacion',
    context: 'general',
    level: 'X',
    category: 'insufficient',
    studyTypes: ['rct', 'in_vitro', 'animal'],
    humanEvidence: true,
    statement: L(
      'La cúrcuma y la curcumina se han estudiado para diversas condiciones inflamatorias, pero la evidencia clínica fiable es escasa y no permite afirmar beneficios concretos.',
      'Turmeric and curcumin have been studied for various inflammatory conditions, but reliable clinical evidence is scarce and does not support specific benefits.',
    ),
    simple: L('Se ha estudiado para la inflamación, pero no está claro que funcione.', 'It has been studied for inflammation, but it is unclear whether it works.'),
    sources: [['nccih-turmeric']],
  }),

  /* -------------------------------------------------------- té verde / EGCG */
  claim({
    id: 'te-verde-prevencion-cancer',
    subject: 'plant:te-verde',
    condition: 'condition:cancer',
    context: 'prevention',
    level: 'X',
    category: 'insufficient',
    studyTypes: ['observational', 'rct'],
    humanEvidence: true,
    statement: L(
      'Los estudios sobre el consumo de té verde y la prevención del cáncer han dado resultados inconsistentes.',
      'Studies on green tea consumption and cancer prevention have had inconsistent results.',
    ),
    simple: L('No está claro si tomar té verde reduce el riesgo de cáncer.', 'It is unclear whether drinking green tea lowers cancer risk.'),
    dontKnow: [L('Si existe un efecto protector y en qué tipos de cáncer.', 'Whether a protective effect exists, and for which cancers.')],
    risks: [L('Extractos concentrados: casos raros de daño hepático.', 'Concentrated extracts: rare cases of liver injury.')],
    sources: [['nccih-green-tea']],
  }),
  claim({
    id: 'egcg-cancer-investigacion',
    subject: 'compound:egcg',
    condition: 'condition:cancer',
    context: 'research',
    level: 'E',
    category: 'preclinical',
    studyTypes: ['in_vitro', 'animal'],
    humanEvidence: false,
    statement: L(
      'El EGCG se investiga en modelos experimentales de cáncer. Los resultados preclínicos no equivalen a eficacia clínica.',
      'EGCG is investigated in experimental cancer models. Preclinical results are not equivalent to clinical efficacy.',
    ),
    simple: L('El EGCG del té verde se estudia en el laboratorio; no está demostrado que trate el cáncer.', 'Green tea EGCG is studied in the lab; it has not been shown to treat cancer.'),
    know: [NOT_A_TREATMENT],
    investigating: [CHECK_TRIALS],
    sources: [['nccih-green-tea'], ['nci-cam']],
  }),

  /* ------------------------------------------------- brócoli / sulforafano */
  claim({
    id: 'cruciferas-prevencion-cancer',
    subject: 'food:brocoli',
    condition: 'condition:cancer',
    context: 'prevention',
    level: 'D',
    category: 'observational',
    studyTypes: ['cohort', 'case_control', 'in_vitro', 'animal'],
    humanEvidence: true,
    statement: L(
      'Los estudios en animales han sugerido efectos protectores de compuestos de las crucíferas, pero los estudios en humanos sobre el consumo de crucíferas y el riesgo de cáncer han mostrado resultados inconsistentes.',
      'Animal studies have suggested protective effects of compounds in cruciferous vegetables, but human studies on cruciferous vegetable intake and cancer risk have shown inconsistent results.',
    ),
    simple: L(
      'Comer brócoli y otras crucíferas forma parte de una dieta saludable, pero no está demostrado que por sí solas prevengan el cáncer.',
      'Eating broccoli and other cruciferous vegetables is part of a healthy diet, but they have not been shown to prevent cancer on their own.',
    ),
    know: [L('Los datos observacionales muestran asociaciones, no causalidad.', 'Observational data show associations, not causation.')],
    dontKnow: [L('Si el efecto observado se debe a las crucíferas o a otros hábitos asociados.', 'Whether the observed effect is due to the vegetables or other associated habits.')],
    limitations: [L('Factor asociado ≠ causa demostrada.', 'Associated factor ≠ proven cause.')],
    sources: [['nci-cruciferous']],
  }),
  claim({
    id: 'sulforafano-cancer-investigacion',
    subject: 'compound:sulforafano',
    condition: 'condition:cancer',
    context: 'research',
    level: 'E',
    category: 'preclinical',
    studyTypes: ['in_vitro', 'animal'],
    humanEvidence: false,
    statement: L(
      'El sulforafano y otros isotiocianatos se investigan en modelos experimentales de cáncer; estos resultados no establecen beneficios en humanos.',
      'Sulforaphane and other isothiocyanates are investigated in experimental cancer models; these results do not establish benefits in humans.',
    ),
    simple: L('El sulforafano del brócoli se estudia en el laboratorio; no es un tratamiento contra el cáncer.', 'Broccoli sulforaphane is studied in the lab; it is not a cancer treatment.'),
    know: [NOT_A_TREATMENT],
    investigating: [CHECK_TRIALS],
    sources: [['nci-cruciferous']],
  }),

  /* ------------------------------------------------------------------- ajo */
  claim({
    id: 'ajo-prevencion-cancer',
    subject: 'plant:ajo',
    condition: 'condition:cancer-gastrico',
    context: 'prevention',
    level: 'D',
    category: 'observational',
    studyTypes: ['observational', 'case_control'],
    humanEvidence: true,
    statement: L(
      'Algunos estudios observacionales han asociado un mayor consumo de ajo con menor riesgo de ciertos cánceres digestivos; los resultados no son consistentes y no demuestran causalidad.',
      'Some observational studies have associated higher garlic intake with lower risk of certain digestive cancers; results are not consistent and do not prove causation.',
    ),
    simple: L('Hay estudios que relacionan comer ajo con menos cáncer de estómago, pero eso no prueba que el ajo lo prevenga.', 'Some studies link eating garlic to less stomach cancer, but that does not prove garlic prevents it.'),
    limitations: [L('Factor asociado ≠ causa demostrada.', 'Associated factor ≠ proven cause.')],
    risks: [L('Los suplementos de ajo pueden aumentar el riesgo de sangrado.', 'Garlic supplements may increase bleeding risk.')],
    sources: [['nci-garlic'], ['nccih-garlic']],
  }),

  /* ------------------------------------------------------- carne procesada */
  claim({
    id: 'carne-procesada-colorrectal',
    subject: 'food:carne-procesada',
    condition: 'condition:cancer-colorrectal',
    context: 'prevention',
    level: 'D',
    category: 'observational',
    studyTypes: ['cohort', 'case_control', 'regulatory_evaluation'],
    humanEvidence: true,
    statement: L(
      'La IARC (OMS) clasificó la carne procesada como carcinógena para humanos (Grupo 1), con base en evidencia epidemiológica suficiente de su relación con el cáncer colorrectal. La carne roja se clasificó como probablemente carcinógena (Grupo 2A).',
      'IARC (WHO) classified processed meat as carcinogenic to humans (Group 1), based on sufficient epidemiological evidence linking it to colorectal cancer. Red meat was classified as probably carcinogenic (Group 2A).',
    ),
    simple: L(
      'Comer carne procesada (embutidos, salchichas) con frecuencia se relaciona con más riesgo de cáncer de colon. Reducir su consumo es una medida de prevención.',
      'Eating processed meat (cold cuts, sausages) often is linked to higher colon cancer risk. Eating less of it is a prevention measure.',
    ),
    know: [
      L('La clasificación del Grupo 1 indica la solidez de la evidencia de que causa cáncer, no la magnitud del riesgo.', 'Group 1 reflects the strength of evidence that it causes cancer, not the size of the risk.'),
    ],
    sources: [['who-red-meat'], ['iarc-monographs']],
  }),

  /* --------------------------------------------------------------- cannabis */
  claim({
    id: 'cannabinoides-nauseas-quimio',
    subject: 'compound:thc',
    condition: 'condition:nauseas-por-quimioterapia',
    context: 'complementary',
    level: 'A',
    category: 'clinical_strong',
    studyTypes: ['rct', 'regulatory_evaluation'],
    humanEvidence: true,
    statement: L(
      'Medicamentos a base de cannabinoides (dronabinol, un THC sintético, y nabilona) están aprobados por la FDA para náuseas y vómitos asociados a la quimioterapia cuando otros tratamientos no han funcionado. Esto se refiere a medicamentos regulados, no a la planta de cannabis.',
      'Cannabinoid-based medicines (dronabinol, a synthetic THC, and nabilone) are FDA-approved for chemotherapy-associated nausea and vomiting when other treatments have not worked. This refers to regulated medicines, not the cannabis plant.',
    ),
    simple: L(
      'Algunos medicamentos hechos con sustancias parecidas a las del cannabis ayudan con las náuseas de la quimioterapia. Los receta el médico; no es lo mismo que usar la planta.',
      'Some medicines made with cannabis-like substances help with chemotherapy nausea. They are prescribed by a doctor; this is not the same as using the plant.',
    ),
    risks: [L('Efectos psicoactivos, mareo, somnolencia.', 'Psychoactive effects, dizziness, drowsiness.')],
    sources: [['nci-cannabis-pdq'], ['nccih-cannabis']],
  }),
  claim({
    id: 'cannabis-tratamiento-cancer',
    subject: 'plant:cannabis',
    condition: 'condition:cancer',
    context: 'cancer_treatment',
    level: 'E',
    category: 'preclinical',
    studyTypes: ['in_vitro', 'animal'],
    humanEvidence: false,
    statement: L(
      'El cannabis y los cannabinoides no han demostrado tratar el cáncer en humanos. Los efectos antitumorales descritos proceden principalmente de estudios en células y animales.',
      'Cannabis and cannabinoids have not been shown to treat cancer in humans. Reported antitumor effects come mainly from cell and animal studies.',
    ),
    simple: L('No hay pruebas de que el cannabis cure el cáncer en personas.', 'There is no proof that cannabis cures cancer in people.'),
    know: [NOT_A_TREATMENT],
    investigating: [CHECK_TRIALS],
    sources: [['nci-cannabis-pdq']],
  }),

  /* ---------------------------------------------------------------- hongos */
  claim({
    id: 'psk-complementario',
    subject: 'compound:psk',
    condition: 'condition:cancer',
    context: 'complementary',
    level: 'B',
    category: 'clinical_limited',
    studyTypes: ['rct'],
    humanEvidence: true,
    statement: L(
      'El PSK se ha evaluado en ensayos clínicos, principalmente en Japón, como complemento de la quimioterapia en algunos tipos de cáncer (por ejemplo, gástrico y colorrectal). Los resultados proceden de poblaciones y protocolos específicos y no se generalizan automáticamente.',
      'PSK has been evaluated in clinical trials, mainly in Japan, as an adjunct to chemotherapy in some cancers (for example, gastric and colorectal). Results come from specific populations and protocols and do not automatically generalize.',
    ),
    simple: L(
      'Una sustancia de un hongo (cola de pavo) se ha probado en Japón junto con la quimioterapia. No sustituye el tratamiento y su uso debe hablarse con el oncólogo.',
      'A substance from a mushroom (turkey tail) has been tested in Japan alongside chemotherapy. It does not replace treatment and must be discussed with the oncologist.',
    ),
    know: [NOT_A_TREATMENT],
    limitations: [
      L('El PSK es un producto farmacéutico estandarizado; comer o tomar el hongo no es equivalente.', 'PSK is a standardized pharmaceutical product; eating or taking the mushroom is not equivalent.'),
    ],
    sources: [['nci-mushrooms-pdq']],
  }),
  claim({
    id: 'reishi-cancer',
    subject: 'mushroom:reishi',
    condition: 'condition:cancer',
    context: 'research',
    level: 'C',
    category: 'preliminary',
    studyTypes: ['in_vitro', 'animal', 'rct'],
    humanEvidence: true,
    statement: L(
      'La investigación del reishi en cáncer es mayoritariamente preclínica; los pocos estudios en humanos son pequeños y de calidad limitada.',
      'Reishi cancer research is mostly preclinical; the few human studies are small and of limited quality.',
    ),
    simple: L('El reishi se estudia en el laboratorio; no se ha demostrado que trate el cáncer.', 'Reishi is studied in the lab; it has not been shown to treat cancer.'),
    know: [NOT_A_TREATMENT],
    sources: [['nci-mushrooms-pdq']],
  }),

  /* ------------------------------------------------------ otros usos clínicos */
  claim({
    id: 'jengibre-nauseas-embarazo',
    subject: 'plant:jengibre',
    condition: 'condition:nauseas-del-embarazo',
    context: 'general',
    level: 'B',
    category: 'clinical_limited',
    studyTypes: ['rct', 'systematic_review'],
    humanEvidence: true,
    statement: L(
      'El jengibre podría ayudar a aliviar las náuseas y los vómitos del embarazo; persisten dudas sobre su seguridad en este periodo.',
      'Ginger may help relieve nausea and vomiting of pregnancy; questions about its safety during pregnancy remain.',
    ),
    simple: L('El jengibre puede ayudar con las náuseas del embarazo, pero consulte antes a su médico.', 'Ginger may help with pregnancy nausea, but ask your doctor first.'),
    risks: [L('Seguridad en el embarazo no completamente establecida.', 'Safety in pregnancy not fully established.')],
    sources: [['nccih-ginger']],
  }),
  claim({
    id: 'menta-sii',
    subject: 'plant:menta',
    condition: 'condition:sindrome-intestino-irritable',
    context: 'general',
    level: 'B',
    category: 'clinical_limited',
    studyTypes: ['rct', 'meta_analysis'],
    humanEvidence: true,
    statement: L(
      'Algunos estudios indican que el aceite de menta en cápsulas puede mejorar los síntomas del síndrome de intestino irritable.',
      'Some studies indicate that peppermint oil in capsules may improve irritable bowel syndrome symptoms.',
    ),
    simple: L('El aceite de menta en cápsulas puede aliviar el colon irritable en algunas personas.', 'Peppermint oil capsules may relieve irritable bowel symptoms in some people.'),
    risks: [L('Puede causar acidez.', 'May cause heartburn.')],
    sources: [['nccih-peppermint-oil']],
  }),
  claim({
    id: 'valeriana-insomnio',
    subject: 'plant:valeriana',
    condition: 'condition:insomnio',
    context: 'general',
    level: 'X',
    category: 'insufficient',
    studyTypes: ['rct'],
    humanEvidence: true,
    statement: L('La investigación sobre la valeriana para el insomnio no es concluyente.', 'Research on valerian for insomnia is inconclusive.'),
    simple: L('No está claro que la valeriana ayude a dormir.', 'It is unclear whether valerian helps with sleep.'),
    sources: [['nccih-valerian']],
  }),
  claim({
    id: 'manzanilla-insomnio',
    subject: 'plant:manzanilla',
    condition: 'condition:insomnio',
    context: 'general',
    level: 'X',
    category: 'insufficient',
    studyTypes: ['rct'],
    humanEvidence: true,
    statement: L('La evidencia sobre la manzanilla para el insomnio es limitada e insuficiente.', 'Evidence on chamomile for insomnia is limited and insufficient.'),
    simple: L('No hay pruebas suficientes de que la manzanilla ayude a dormir.', 'There is not enough proof that chamomile helps with sleep.'),
    sources: [['nccih-chamomile']],
  }),
  claim({
    id: 'equinacea-resfriado',
    subject: 'plant:equinacea',
    condition: 'condition:resfriado-comun',
    context: 'general',
    level: 'X',
    category: 'insufficient',
    studyTypes: ['rct', 'systematic_review'],
    humanEvidence: true,
    statement: L(
      'Los estudios sobre equinácea para prevenir o tratar el resfriado común han dado resultados contradictorios; los productos estudiados varían mucho entre sí.',
      'Studies on echinacea for preventing or treating the common cold have had conflicting results; the products studied vary widely.',
    ),
    simple: L('No está claro que la equinácea prevenga o cure el resfriado.', 'It is unclear whether echinacea prevents or treats colds.'),
    sources: [['nccih-echinacea']],
  }),
  claim({
    id: 'hiperico-depresion',
    subject: 'plant:hiperico',
    condition: 'condition:depresion',
    context: 'general',
    level: 'B',
    category: 'clinical_limited',
    studyTypes: ['rct', 'meta_analysis'],
    humanEvidence: true,
    statement: L(
      'Existe evidencia de que el hipérico puede ayudar en la depresión leve a moderada, pero interactúa de forma peligrosa con muchos medicamentos, incluidos antidepresivos.',
      "There is evidence that St. John's wort may help mild to moderate depression, but it interacts dangerously with many medicines, including antidepressants.",
    ),
    simple: L(
      'Puede ayudar en algunas depresiones leves, pero mezcla mal con muchas medicinas. La depresión debe tratarla un profesional.',
      'It may help some mild depression, but it mixes badly with many medicines. Depression should be treated by a professional.',
    ),
    risks: [L('Interacciones graves con medicamentos.', 'Serious drug interactions.')],
    sources: [['nccih-st-johns-wort']],
  }),
  claim({
    id: 'ginseng-glucosa',
    subject: 'plant:ginseng',
    condition: 'condition:diabetes-tipo-2',
    context: 'general',
    level: 'C',
    category: 'preliminary',
    studyTypes: ['rct'],
    humanEvidence: true,
    statement: L(
      'El ginseng asiático puede reducir la glucosa en sangre; los estudios son pequeños y no establecen un uso para tratar la diabetes.',
      'Asian ginseng may lower blood sugar; studies are small and do not establish a use for treating diabetes.',
    ),
    simple: L('Puede bajar el azúcar en sangre; si toma medicinas para la diabetes, consulte antes.', 'It may lower blood sugar; if you take diabetes medicines, ask first.'),
    risks: [L('Riesgo de hipoglucemia combinado con antidiabéticos.', 'Risk of low blood sugar combined with diabetes medicines.')],
    sources: [['nccih-asian-ginseng']],
  }),
];
