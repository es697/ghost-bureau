import type { ConditionId, FeatureId, Place } from './types';

/** All formula numbers in one place — the "How the score is calculated" screen shows them too */
export const RULES = {
  baseScore: 100,
  /** Hard limit: a bigger temperature difference — we don't assign */
  maxTempDiff: 10,
  /** Penalty for each degree away from the favorite temperature */
  tempPenaltyPerDegree: 2,
  /** Penalty for each unit of light (even allowed light is unnerving) */
  lightPenaltyPerUnit: 2,
  /** Noise is penalized in proportion to anxiety: noise × anxiety / divisor */
  noiseDivisor: 5,
  /** Minimum humidity for damp lovers */
  dampMin: 60,
  /** Silence for needsSilence */
  silenceMaxNoise: 2,
} as const;

/** Allowed light: the more anxious the ghost, the darker it must be */
export const maxLightFor = (anxiety: number) => 10 - anxiety;

export const FEATURES: Record<FeatureId, string> = {
  attic: 'Attic',
  basement: 'Basement',
  mirrors: 'Mirrors',
  books: 'Books',
  stage: 'Stage',
  water: 'Water nearby',
};

/**
 * A request's special condition. As in the spec: if a place conflicts with it,
 * the ghost can't be relocated there, and the operator sees the reason.
 */
export interface ConditionDef {
  label: string;
  /** Conflict text, or null if the place meets the condition */
  violation: (p: Place) => string | null;
  /** A short "plus" to explain the choice */
  okText: string;
}

export const CONDITIONS: Record<ConditionId, ConditionDef> = {
  needsAttic: {
    label: 'Needs an attic',
    violation: (p) => (p.features.includes('attic') ? null : 'no attic'),
    okText: 'attic available',
  },
  needsBasement: {
    label: 'Needs a basement',
    violation: (p) => (p.features.includes('basement') ? null : 'no basement'),
    okText: 'basement available',
  },
  fearsMirrors: {
    label: 'Afraid of mirrors',
    violation: (p) => (p.features.includes('mirrors') ? 'there are mirrors' : null),
    okText: 'no mirrors',
  },
  noHumans: {
    label: 'No humans nearby',
    violation: (p) => (p.hasHumans ? 'humans live here' : null),
    okText: 'no humans',
  },
  needsSilence: {
    label: 'Needs silence',
    violation: (p) =>
      p.noise > RULES.silenceMaxNoise ? `too noisy: ${p.noise}, needs no more than ${RULES.silenceMaxNoise}` : null,
    okText: 'quiet',
  },
  lovesDamp: {
    label: 'Loves damp',
    violation: (p) =>
      p.humidity < RULES.dampMin ? `too dry: humidity ${p.humidity}%, needs at least ${RULES.dampMin}%` : null,
    okText: 'damp',
  },
  lovesBooks: {
    label: 'Loves books',
    violation: (p) => (p.features.includes('books') ? null : 'no books'),
    okText: 'books available',
  },
};

export const CONDITION_IDS = Object.keys(CONDITIONS) as ConditionId[];
export const FEATURE_IDS = Object.keys(FEATURES) as FeatureId[];
