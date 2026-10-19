export type ConditionId =
  | 'needsAttic'
  | 'needsBasement'
  | 'fearsMirrors'
  | 'noHumans'
  | 'needsSilence'
  | 'lovesDamp'
  | 'lovesBooks';

export type FeatureId = 'attic' | 'basement' | 'mirrors' | 'books' | 'stage' | 'water';

export interface Ghost {
  id: string;
  name: string;
  /** 1 — unflappable, 10 — panics at a creaking floorboard */
  anxiety: number;
  /** °C */
  favoriteTemp: number;
  /** YYYY-MM-DD, the last day relocation is allowed */
  deadline: string;
  conditions: ConditionId[];
  note?: string;
}

export interface Place {
  id: string;
  name: string;
  emoji: string;
  capacity: number;
  /** 0 — pitch black, 10 — a lighthouse beam */
  light: number;
  /** 0 — dead silence, 10 — a printing press */
  noise: number;
  /** % */
  humidity: number;
  /** °C */
  temperature: number;
  hasHumans: boolean;
  features: FeatureId[];
  /** Place limit: will not take ghosts more anxious than this level. null — no limit */
  maxAnxiety: number | null;
  note?: string;
}

export interface BureauData {
  /** The bureau's "today", YYYY-MM-DD. Fixed in the data so the demo never goes stale */
  today: string;
  ghosts: Ghost[];
  places: Place[];
  /** Operator's manual overrides: ghostId -> placeId */
  overrides: Record<string, string>;
  /**
   * Requests that have already gone through automatic assignment.
   * The rest are "new": the bureau has not processed them yet, and they take no space until the operator runs assignment.
   */
  processed: string[];
  /**
   * Requests the operator housed beyond capacity (confirmed in the "Place over capacity" dialog).
   * They do not take the space of current residents — the place simply becomes over capacity.
   */
  overCapacity?: string[];
}
