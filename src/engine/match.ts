import { daysBetween, formatDate } from './dates';
import { CONDITIONS, RULES, maxLightFor } from './rules';
import type { BureauData, Ghost, Place } from './types';

export interface Violation {
  code: 'TOO_BRIGHT' | 'TOO_HOT' | 'TOO_COLD' | 'ANXIETY_LIMIT' | 'CONDITION' | 'CLOSED';
  text: string;
}

export interface Penalty {
  label: string;
  points: number;
}

/** Scores a "ghost × place" pair, ignoring capacity */
export interface Evaluation {
  placeId: string;
  ok: boolean;
  violations: Violation[];
  penalties: Penalty[];
  /** Pros: which special conditions the place satisfies */
  pros: string[];
  score: number;
}

export type UnassignedReason = 'DEADLINE_EXPIRED' | 'NO_SUITABLE_PLACE' | 'ALL_FULL' | 'NO_PLACES';

export interface Assignment {
  ghostId: string;
  placeId: string | null;
  /** pending — a new request, automatic assignment has not run for it yet */
  mode: 'auto' | 'manual' | 'none' | 'pending';
  score: number | null;
  /** A short explanation of the choice (or the reason for refusal) — strings for the UI */
  explanation: string[];
  unassignedReason?: UnassignedReason;
  /** For a manual pick: what is wrong with it */
  warnings: string[];
  /** All places, sorted: suitable by descending score, then unsuitable */
  evaluations: Evaluation[];
  /** The best place by score ignoring capacity (id) — the "ideal" for comparison */
  recommendedPlaceId: string | null;
}

export interface MatchResult {
  assignments: Record<string, Assignment>;
  /** placeId -> ghostIds housed there (auto + manual) */
  occupancy: Record<string, string[]>;
  /** The order in which the algorithm processed the requests */
  order: string[];
}

export function evaluatePlace(ghost: Ghost, place: Place): Evaluation {
  const violations: Violation[] = [];
  const penalties: Penalty[] = [];
  const pros: string[] = [];

  if (place.capacity === 0) violations.push({ code: 'CLOSED', text: 'place is closed (capacity 0)' });

  const maxLight = maxLightFor(ghost.anxiety);
  if (place.light > maxLight) {
    violations.push({
      code: 'TOO_BRIGHT',
      text: `too bright: light ${place.light}, at anxiety ${ghost.anxiety} the limit is ≤ ${Math.max(0, maxLight)}`,
    });
  }

  const dt = place.temperature - ghost.favoriteTemp;
  if (Math.abs(dt) > RULES.maxTempDiff) {
    violations.push({
      code: dt > 0 ? 'TOO_HOT' : 'TOO_COLD',
      text: `${dt > 0 ? 'too warm' : 'too cold'}: ${place.temperature}° vs the preferred ${ghost.favoriteTemp}° (difference > ${RULES.maxTempDiff}°)`,
    });
  }

  if (place.maxAnxiety !== null && ghost.anxiety > place.maxAnxiety) {
    violations.push({
      code: 'ANXIETY_LIMIT',
      text: `the place does not accept anxiety above ${place.maxAnxiety} (the ghost has ${ghost.anxiety})`,
    });
  }

  for (const id of ghost.conditions) {
    const c = CONDITIONS[id];
    const v = c.violation(place);
    if (v) violations.push({ code: 'CONDITION', text: `${c.label.toLowerCase()}, but ${v}` });
    else pros.push(c.okText);
  }

  if (dt !== 0) {
    penalties.push({
      label: `Temperature ${place.temperature}° instead of the preferred ${ghost.favoriteTemp}°`,
      points: Math.abs(dt) * RULES.tempPenaltyPerDegree,
    });
  }
  const noisePts = Math.round((place.noise * ghost.anxiety) / RULES.noiseDivisor);
  if (noisePts > 0) penalties.push({ label: `Noise ${place.noise} at anxiety ${ghost.anxiety}`, points: noisePts });
  const lightPts = place.light * RULES.lightPenaltyPerUnit;
  if (lightPts > 0) penalties.push({ label: `Light ${place.light}`, points: lightPts });

  penalties.sort((a, b) => b.points - a.points);
  const score = Math.max(0, RULES.baseScore - penalties.reduce((s, p) => s + p.points, 0));
  return { placeId: place.id, ok: violations.length === 0, violations, penalties, pros, score };
}

function sortEvaluations(evals: Evaluation[], places: Map<string, Place>): Evaluation[] {
  return [...evals].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return (places.get(a.placeId)?.name ?? '').localeCompare(places.get(b.placeId)?.name ?? '', 'en');
  });
}

function summarize(e: Evaluation): string {
  const parts: string[] = [];
  if (e.pros.length) parts.push(`Pros: ${e.pros.join(', ')}.`);
  const top = e.penalties.slice(0, 2).map((p) => `${p.label.toLowerCase()} (−${p.points})`);
  parts.push(top.length ? `Main penalties: ${top.join(', ')}.` : 'No penalties.');
  return parts.join(' ');
}

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const isExpired = (ghost: Ghost, today: string) => daysBetween(today, ghost.deadline) < 0;

/**
 * Finds places for every request.
 *
 * 1. The operator's manual overrides are applied first and take space (even beyond capacity — that is the "overload").
 * 2. The remaining requests are assigned greedily in priority order:
 *    earlier deadline → fewer suitable options → higher anxiety
 *    (expired ones go last: we don't assign them anyway).
 *    Each gets the place with the best score that still has free space.
 */
export function assignAll(data: BureauData): MatchResult {
  const placesById = new Map(data.places.map((p) => [p.id, p]));
  const occupancy: Record<string, string[]> = Object.fromEntries(data.places.map((p) => [p.id, []]));
  const assignments: Record<string, Assignment> = {};

  const evalsByGhost = new Map<string, Evaluation[]>();
  for (const g of data.ghosts) {
    evalsByGhost.set(g.id, sortEvaluations(data.places.map((p) => evaluatePlace(g, p)), placesById));
  }
  const recommendedOf = (g: Ghost) => {
    if (isExpired(g, data.today)) return null;
    return evalsByGhost.get(g.id)!.find((e) => e.ok)?.placeId ?? null;
  };

  // 1. Manual overrides
  const manual = data.ghosts.filter((g) => {
    const pid = data.overrides[g.id];
    return pid !== undefined && placesById.has(pid);
  });
  // Ghosts housed beyond capacity take no space — we add them after auto-assignment so nobody gets evicted
  const overCapacity = new Set(data.overCapacity ?? []);
  for (const g of manual) {
    if (!overCapacity.has(g.id)) occupancy[data.overrides[g.id]].push(g.id);
  }

  // 2. Auto-assignment. New requests wait for assignment to be run and take no space
  const processed = new Set(data.processed);
  const pending = data.ghosts.filter((g) => !manual.includes(g) && !processed.has(g.id));
  const auto = data.ghosts.filter((g) => !manual.includes(g) && processed.has(g.id));
  const okCount = (g: Ghost) => evalsByGhost.get(g.id)!.filter((e) => e.ok).length;
  const expired = (g: Ghost) => (isExpired(g, data.today) ? 1 : 0);
  const order = [...auto].sort(
    (a, b) =>
      expired(a) - expired(b) ||
      a.deadline.localeCompare(b.deadline) ||
      okCount(a) - okCount(b) ||
      b.anxiety - a.anxiety ||
      a.name.localeCompare(b.name, 'en'),
  );

  for (const g of order) {
    const evaluations = evalsByGhost.get(g.id)!;
    const base = { ghostId: g.id, evaluations, warnings: [], recommendedPlaceId: recommendedOf(g) };

    if (isExpired(g, data.today)) {
      assignments[g.id] = {
        ...base,
        placeId: null,
        mode: 'none',
        score: null,
        unassignedReason: 'DEADLINE_EXPIRED',
        explanation: [`The deadline ${formatDate(g.deadline)} has already passed — the bureau does not auto-assign overdue requests.`],
      };
      continue;
    }
    if (data.places.length === 0) {
      assignments[g.id] = {
        ...base,
        placeId: null,
        mode: 'none',
        score: null,
        unassignedReason: 'NO_PLACES',
        explanation: ['The bureau has no relocation place at all — add a place.'],
      };
      continue;
    }

    const suitable = evaluations.filter((e) => e.ok);
    if (suitable.length === 0) {
      assignments[g.id] = {
        ...base,
        placeId: null,
        mode: 'none',
        score: null,
        unassignedReason: 'NO_SUITABLE_PLACE',
        explanation: [
          'No place is suitable:',
          ...evaluations.map((e) => `${placesById.get(e.placeId)!.name}: ${e.violations.map((v) => v.text).join('; ')}`),
        ],
      };
      continue;
    }

    const chosen = suitable.find((e) => occupancy[e.placeId].length < placesById.get(e.placeId)!.capacity);
    if (!chosen) {
      assignments[g.id] = {
        ...base,
        placeId: null,
        mode: 'none',
        score: null,
        unassignedReason: 'ALL_FULL',
        explanation: [
          'Suitable places exist, but they are all full:',
          ...suitable.map((e) => {
            const p = placesById.get(e.placeId)!;
            return `${p.name} (${occupancy[p.id].length}/${p.capacity}) — ${e.score} ${plural(e.score, 'point', 'points', 'points')}`;
          }),
        ],
      };
      continue;
    }

    occupancy[chosen.placeId].push(g.id);
    const lead =
      suitable.length === 1
        ? 'The only suitable place.'
        : `The best free option out of ${suitable.length} ${plural(suitable.length, 'suitable place', 'suitable places', 'suitable places')}.`;
    const explanation = [`${lead} ${summarize(chosen)}`];
    if (chosen !== suitable[0]) {
      const best = placesById.get(suitable[0].placeId)!;
      explanation.push(`The best option — ${best.name} (${suitable[0].score}) — is already full: earlier requests in the queue took it.`);
    } else if (suitable.length > 1) {
      const next = suitable[1];
      explanation.push(`Next best by score — ${placesById.get(next.placeId)!.name} (${next.score}).`);
    }
    assignments[g.id] = { ...base, placeId: chosen.placeId, mode: 'auto', score: chosen.score, explanation };
  }

  for (const g of manual) {
    if (overCapacity.has(g.id)) occupancy[data.overrides[g.id]].push(g.id);
  }

  // 3. Warnings for manual overrides (after auto, so we know the final load)
  for (const g of manual) {
    const pid = data.overrides[g.id];
    const place = placesById.get(pid)!;
    const evaluations = evalsByGhost.get(g.id)!;
    const ev = evaluations.find((e) => e.placeId === pid)!;
    const warnings = validateManualChoice(g, place, ev, occupancy[pid].length, data.today);
    const recommended = recommendedOf(g);
    if (recommended && recommended !== pid) {
      const r = evaluations.find((e) => e.placeId === recommended)!;
      if (r.score > ev.score) {
        warnings.push(`Score ${ev.score} is below the best possible: ${placesById.get(recommended)!.name} — ${r.score}.`);
      }
    }
    assignments[g.id] = {
      ghostId: g.id,
      placeId: pid,
      mode: 'manual',
      score: ev.score,
      evaluations,
      warnings,
      recommendedPlaceId: recommended,
      explanation: [`Chosen manually by the operator. ${summarize(ev)}`],
    };
  }

  const pendingOrder = [...pending].sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, 'en'));
  for (const g of pendingOrder) {
    assignments[g.id] = {
      ghostId: g.id,
      placeId: null,
      mode: 'pending',
      score: null,
      evaluations: evalsByGhost.get(g.id)!,
      warnings: [],
      recommendedPlaceId: recommendedOf(g),
      explanation: ['This request has not been processed yet. Run automatic assignment or choose a place manually.'],
    };
  }

  return {
    assignments,
    occupancy,
    order: [...manual.map((g) => g.id), ...order.map((g) => g.id), ...pendingOrder.map((g) => g.id)],
  };
}

/** What is wrong with a manual pick (an empty array means it is fine) */
export function validateManualChoice(
  ghost: Ghost,
  place: Place,
  ev: Evaluation,
  occupantsIncludingGhost: number,
  today: string,
): string[] {
  const warnings: string[] = [];
  if (isExpired(ghost, today)) warnings.push(`Deadline ${formatDate(ghost.deadline)} has already passed.`);
  for (const v of ev.violations) warnings.push(`${v.text[0].toUpperCase()}${v.text.slice(1)}.`);
  // For a closed place "the place is closed" is enough — "over capacity" would be a duplicate
  if (place.capacity > 0 && occupantsIncludingGhost > place.capacity) {
    warnings.push(
      `Place over capacity: ${occupantsIncludingGhost} ${plural(occupantsIncludingGhost, 'ghost', 'ghosts', 'ghosts')} with a capacity of ${place.capacity}.`,
    );
  }
  return warnings;
}
