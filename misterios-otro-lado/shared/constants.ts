// Constantes compartidas entre cliente y servidor.
// El servidor es SIEMPRE la autoridad: el cliente sólo las usa para predecir/animar.

export const GAME_NAME = 'Misterios: El Otro Lado';
export const PROTOCOL_VERSION = 1;

export const MOVE = {
  walkSpeed: 3.4,
  runSpeed: 6.2,
  /** Velocidad máxima aceptada por el servidor (incluye tolerancia de red). */
  serverMaxSpeed: 8.5,
  /** Distancia máxima que se tolera en un único paquete antes de considerarlo teletransporte. */
  maxSingleStep: 12,
  playerRadius: 0.4,
};

export const NET = {
  /** Frecuencia con la que el servidor envía snapshots (Hz). */
  snapshotRate: 10,
  /** Frecuencia con la que el cliente envía su posición (Hz). */
  clientSendRate: 12,
  /** Radio de interés: sólo se sincronizan jugadores dentro de esta distancia. */
  interestRadius: 90,
  maxPlayersPerShard: 40,
};

export const INTERACT = {
  /** Distancia de interacción que usa el cliente para mostrar el aviso. */
  clientRange: 2.8,
  /** Tolerancia extra que concede el servidor por latencia. */
  serverTolerance: 1.8,
};

export const SOCIAL = {
  partyMax: 4,
  chatMaxLen: 200,
  /** Distancia a la que un compañero de grupo recibe el avance cooperativo. */
  coopShareRadius: 45,
};

/** Duración de un día completo del mundo en segundos reales. */
export const DAY_LENGTH_SEC = 24 * 60;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  uncommon: 'Poco común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
};
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b8b8b8',
  uncommon: '#5fbf6a',
  rare: '#4f8fe0',
  epic: '#a55fe0',
  legendary: '#e0a33a',
};

export type CurrencyCode = 'coins' | 'gems' | 'rp';
export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  coins: 'Monedas',
  gems: 'Gemas',
  rp: 'Puntos de recompensa',
};

/**
 * Hora del mundo (0..1, 0 = medianoche, 0.5 = mediodía) derivada del reloj del servidor.
 * El desfase hace que al arrancar el servidor sea atardecer.
 */
export function worldTimeOfDay(epochMs: number, dayLengthSec = DAY_LENGTH_SEC): number {
  const t = (epochMs / 1000 / dayLengthSec + 0.8) % 1;
  return t < 0 ? t + 1 : t;
}

export function isNightTime(timeOfDay: number): boolean {
  return timeOfDay < 0.23 || timeOfDay > 0.78;
}

export function formatClock(timeOfDay: number): string {
  const mins = Math.floor(timeOfDay * 24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
