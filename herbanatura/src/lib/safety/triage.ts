import { normalize } from '@/lib/search/normalize';

/**
 * Deterministic safety triage that runs BEFORE search results or any AI call.
 * It never diagnoses; it only decides which safety notices must be shown and
 * whether natural-remedy content must be withheld.
 */

export type EmergencyKind =
  | 'chest_pain'
  | 'breathing'
  | 'consciousness'
  | 'seizure'
  | 'bleeding'
  | 'anaphylaxis'
  | 'stroke'
  | 'poisoning'
  | 'self_harm';

export interface TriageResult {
  emergency: EmergencyKind[];
  /** User wants to treat/cure cancer with natural products. */
  cancerTreatmentIntent: boolean;
  /** User mentions stopping or replacing prescribed treatment. */
  stopTreatmentIntent: boolean;
  /** Pregnancy or breastfeeding mentioned. */
  pregnancyMention: boolean;
  /** Natural-remedy suggestions must not be shown (emergency present). */
  withholdRemedies: boolean;
}

const EMERGENCY_PATTERNS: Record<EmergencyKind, RegExp[]> = {
  chest_pain: [/dolor (fuerte |intenso |muy fuerte )?(de|en el) pecho/, /opresion (en el )?pecho/, /chest pain/, /pain in (my|the) chest/, /infarto/, /heart attack/],
  breathing: [/no puedo respirar/, /dificultad (para|al) respirar/, /me falta el aire/, /me ahogo/, /can ?t breathe/, /cannot breathe/, /shortness of breath/, /trouble breathing/, /asfixia/],
  consciousness: [/perdi(o|da)? (el )?conocimiento/, /se desmayo/, /desmayo/, /inconsciente/, /no responde/, /fainted/, /passed out/, /unconscious/, /loss of consciousness/],
  seizure: [/convulsion/, /convulsiona/, /crisis epileptica/, /ataque epileptico/, /seizure/, /convulsing/],
  bleeding: [/sangrado (abundante|importante|que no para|fuerte)/, /hemorragia/, /vomito (con )?sangre/, /sangre en (el )?vomito/, /heavy bleeding/, /bleeding (heavily|that won ?t stop)/, /vomiting blood/],
  anaphylaxis: [/anafilaxi/, /se me cierra la garganta/, /hinchazon de (la )?(cara|lengua|garganta|labios)/, /reaccion alergica (grave|severa|fuerte)/, /throat (is )?closing/, /swollen (tongue|throat|lips|face)/, /severe allergic/, /anaphyla/],
  stroke: [/no puedo mover (un|el|la|medio)/, /cara (caida|torcida|desviada)/, /habla arrastrada/, /no puedo hablar/, /entumecimiento repentino/, /derrame cerebral/, /embolia/, /stroke/, /face drooping/, /slurred speech/, /sudden (numbness|weakness|confusion)/],
  poisoning: [/intoxica/, /envenena/, /sobredosis/, /me trague/, /comi (un|una|unos|unas) hongo/, /poison/, /overdose/, /ate a (wild )?mushroom/],
  self_harm: [/suicid/, /quitarme la vida/, /quiero morir/, /hacerme dano/, /kill myself/, /end my life/, /self[ -]?harm/, /want to die/],
};

const CANCER_TREATMENT = [
  /(tratar|curar|curarme|combatir|eliminar|quitar|sanar|vencer).{0,30}(cancer|tumor|leucemia|linfoma|metastasis)/,
  /(cancer|tumor).{0,30}(con|solo con|usando) (plantas|hierbas|remedios|naturales|hongos|te|tes|infusiones)/,
  /(cura|remedio|tratamiento) (natural )?(para|contra|del) (el )?(cancer|tumor)/,
  /(treat|cure|heal|fight|beat).{0,30}(cancer|tumou?r|leukemia|lymphoma)/,
  /(cancer|tumou?r).{0,30}(with|using) (herbs|plants|natural|mushrooms)/,
  /natural (cure|remedy|treatment) for cancer/,
];

const STOP_TREATMENT = [
  /(dejar|abandonar|suspender|parar|sustituir|reemplazar|cambiar).{0,25}(quimio|radio|tratamiento|medicamento|medicina|pastillas|insulina|cirugia|operacion|inmunoterapia|hormon)/,
  /en (lugar|vez) de (la )?(quimio|radio|cirugia|tratamiento|medicamento|medicina)/,
  /(stop|quit|replace|instead of|skip).{0,25}(chemo|radiation|treatment|medication|medicine|surgery|insulin|immunotherapy)/,
  /sin (quimio|radio|cirugia)/,
];

const PREGNANCY = [/embaraz/, /lactan/, /amamant/, /pregnan/, /breastfeed/, /nursing/];

export function triage(text: string): TriageResult {
  const n = normalize(text);
  const emergency = (Object.keys(EMERGENCY_PATTERNS) as EmergencyKind[]).filter((k) => EMERGENCY_PATTERNS[k].some((re) => re.test(n)));
  return {
    emergency,
    cancerTreatmentIntent: CANCER_TREATMENT.some((re) => re.test(n)),
    stopTreatmentIntent: STOP_TREATMENT.some((re) => re.test(n)),
    pregnancyMention: PREGNANCY.some((re) => re.test(n)),
    withholdRemedies: emergency.length > 0,
  };
}
