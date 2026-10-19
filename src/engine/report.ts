import { daysBetween } from './dates';
import type { MatchResult, UnassignedReason } from './match';
import type { BureauData } from './types';

export interface ProblemGhost {
  ghostId: string;
  severity: number;
  reasons: string[];
}

export type PlaceStatus = 'overloaded' | 'full' | 'ok' | 'empty' | 'closed';

export interface PlaceLoad {
  placeId: string;
  occupants: number;
  capacity: number;
  status: PlaceStatus;
  /** How many requests this place suits by its hard requirements */
  demand: number;
  /** For how many requests this place is the best option */
  topChoiceFor: number;
}

export interface Report {
  total: number;
  settled: number;
  /** Processed, but could not be assigned — needs the operator's decision */
  unsettled: number;
  /** New: automatic assignment has not been run for them yet */
  pending: number;
  manual: number;
  manualWithWarnings: number;
  byReason: Record<UnassignedReason, number>;
  problems: ProblemGhost[];
  places: PlaceLoad[];
}

export const REASON_LABELS: Record<UnassignedReason, string> = {
  DEADLINE_EXPIRED: 'Deadline expired',
  NO_SUITABLE_PLACE: 'No suitable place',
  ALL_FULL: 'Suitable places are full',
  NO_PLACES: 'No places in the bureau',
};

export function buildReport(data: BureauData, result: MatchResult): Report {
  const all = Object.values(result.assignments);
  const byReason: Record<UnassignedReason, number> = {
    DEADLINE_EXPIRED: 0,
    NO_SUITABLE_PLACE: 0,
    ALL_FULL: 0,
    NO_PLACES: 0,
  };
  for (const a of all) if (a.unassignedReason) byReason[a.unassignedReason]++;

  const problems: ProblemGhost[] = [];
  for (const g of data.ghosts) {
    const a = result.assignments[g.id];
    const reasons: string[] = [];
    let severity = 0;
    if (a.unassignedReason) {
      severity += 100;
      reasons.push(`Without a place: ${REASON_LABELS[a.unassignedReason].toLowerCase()}`);
    }
    if (a.mode === 'manual' && a.warnings.length > 0) {
      severity += 60 + a.warnings.length * 5;
      reasons.push(`Manual pick with problems (${a.warnings.length})`);
    }
    const days = daysBetween(data.today, g.deadline);
    if (days >= 0 && days <= 2) {
      severity += 20;
      reasons.push(days === 0 ? 'Deadline today' : `Deadline in ${days} days`);
    }
    if (a.score !== null && a.score < 60) {
      severity += 15;
      reasons.push(`Low score: ${a.score}`);
    }
    if (severity > 0) problems.push({ ghostId: g.id, severity, reasons });
  }
  problems.sort((x, y) => y.severity - x.severity);

  const places: PlaceLoad[] = data.places.map((p) => {
    const occupants = result.occupancy[p.id]?.length ?? 0;
    const status: PlaceStatus =
      p.capacity === 0
        ? occupants > 0
          ? 'overloaded'
          : 'closed'
        : occupants > p.capacity
          ? 'overloaded'
          : occupants === p.capacity
            ? 'full'
            : occupants === 0
              ? 'empty'
              : 'ok';
    let demand = 0;
    let topChoiceFor = 0;
    for (const a of all) {
      if (a.evaluations.some((e) => e.placeId === p.id && e.ok)) demand++;
      if (a.recommendedPlaceId === p.id) topChoiceFor++;
    }
    return { placeId: p.id, occupants, capacity: p.capacity, status, demand, topChoiceFor };
  });

  const settled = all.filter((a) => a.placeId !== null).length;
  const manualAll = all.filter((a) => a.mode === 'manual');
  return {
    total: data.ghosts.length,
    settled,
    unsettled: all.filter((a) => a.unassignedReason).length,
    pending: all.filter((a) => a.mode === 'pending').length,
    manual: manualAll.length,
    manualWithWarnings: manualAll.filter((a) => a.warnings.length > 0).length,
    byReason,
    problems,
    places,
  };
}
