import { describe, expect, it } from 'vitest';
import { DEMO_PLACES, DEMO_TODAY, SCENARIOS } from '../data/demo';
import { assignAll, evaluatePlace } from './match';
import { buildReport } from './report';
import type { BureauData, Ghost, Place } from './types';

const place = (over: Partial<Place> = {}): Place => ({
  id: 'p',
  name: 'Crypt',
  emoji: '⚰️',
  capacity: 1,
  light: 0,
  noise: 0,
  humidity: 50,
  temperature: 10,
  hasHumans: false,
  features: [],
  maxAnxiety: null,
  ...over,
});

const ghost = (over: Partial<Ghost> = {}): Ghost => ({
  id: 'g',
  name: 'Casper',
  anxiety: 5,
  favoriteTemp: 10,
  deadline: '2026-11-10',
  conditions: [],
  ...over,
});

/** By default every request has already gone through automatic assignment */
const data = (ghosts: Ghost[], places: Place[], overrides: Record<string, string> = {}): BureauData => ({
  today: DEMO_TODAY,
  ghosts,
  places,
  overrides,
  processed: ghosts.map((g) => g.id),
});

/** The demo after pressing "Assign automatically" */
const demo = (): BureauData => {
  const d = SCENARIOS.find((s) => s.id === 'demo')!.build() as BureauData;
  return { ...d, processed: d.ghosts.map((g) => g.id) };
};

describe('evaluatePlace — formula and hard requirements', () => {
  it('a perfect place gives 100 points', () => {
    const e = evaluatePlace(ghost(), place());
    expect(e.ok).toBe(true);
    expect(e.score).toBe(100);
  });

  it('counts penalties by the formula: 2/degree, 2/unit of light, noise × anxiety / 5', () => {
    const e = evaluatePlace(ghost({ anxiety: 5, favoriteTemp: 10 }), place({ temperature: 13, light: 2, noise: 4 }));
    // 100 − 3·2 − 2·2 − round(4·5/5)=4 → 86
    expect(e.score).toBe(86);
  });

  it('too bright for an anxious ghost — a hard refusal', () => {
    const e = evaluatePlace(ghost({ anxiety: 8 }), place({ light: 3 }));
    expect(e.ok).toBe(false);
    expect(e.violations[0].code).toBe('TOO_BRIGHT');
  });

  it('special conditions: mirrors, humans, attic', () => {
    const g = ghost({ conditions: ['fearsMirrors', 'noHumans', 'needsAttic'] });
    const e = evaluatePlace(g, place({ features: ['mirrors'], hasHumans: true }));
    expect(e.violations.map((v) => v.text).join(' | ')).toMatch(/mirrors.*humans.*attic/);
  });

  it('boundaries are inclusive: light exactly 10 − anxiety, difference exactly 10°, deadline today', () => {
    const g = ghost({ anxiety: 6, favoriteTemp: 10, deadline: DEMO_TODAY });
    expect(evaluatePlace(g, place({ light: 4, temperature: 20 })).ok).toBe(true);
    expect(evaluatePlace(g, place({ light: 5 })).violations[0].code).toBe('TOO_BRIGHT');
    expect(evaluatePlace(g, place({ temperature: -1 })).violations[0].code).toBe('TOO_COLD');
    expect(assignAll(data([g], [place()])).assignments.g.placeId).toBe('p');
  });

  it('a place limit on anxiety', () => {
    const e = evaluatePlace(ghost({ anxiety: 7, conditions: [] }), place({ light: 0, maxAnxiety: 6 }));
    expect(e.violations.map((v) => v.code)).toContain('ANXIETY_LIMIT');
  });
});

describe('assignAll — matching', () => {
  it('an empty request list breaks neither assignment nor the report', () => {
    const d = data([], DEMO_PLACES);
    const r = assignAll(d);
    const rep = buildReport(d, r);
    expect(rep.total).toBe(0);
    expect(rep.settled).toBe(0);
    expect(rep.problems).toEqual([]);
  });

  it('a request with no suitable place gets reasons for every place', () => {
    const r = assignAll(demo());
    const ned = r.assignments.ned;
    expect(ned.placeId).toBeNull();
    expect(ned.unassignedReason).toBe('NO_SUITABLE_PLACE');
    expect(ned.explanation.length).toBe(1 + DEMO_PLACES.length);
  });

  it('an expired deadline — we do not assign', () => {
    const r = assignAll(demo());
    expect(r.assignments.oswald.unassignedReason).toBe('DEADLINE_EXPIRED');
  });

  it('does not exceed capacity: urgent requests take a place first', () => {
    const d = data(
      [ghost({ id: 'late', deadline: '2026-11-20' }), ghost({ id: 'urgent', deadline: '2026-11-01' })],
      [place({ capacity: 1 })],
    );
    const r = assignAll(d);
    expect(r.assignments.urgent.placeId).toBe('p');
    expect(r.assignments.late.unassignedReason).toBe('ALL_FULL');
    expect(r.occupancy.p).toHaveLength(1);
  });

  it('in the demo the printworks basement does not overflow and Auntie Dust is left without a place', () => {
    const r = assignAll(demo());
    expect(r.occupancy.press.length).toBeLessThanOrEqual(2);
    expect(r.assignments.dust.unassignedReason).toBe('ALL_FULL');
  });

  it('if the best place is taken, the next one is used and this is explained', () => {
    const r = assignAll(demo());
    expect(r.assignments.mary.placeId).toBe('castle');
    expect(r.assignments.mary.explanation.join(' ')).toMatch(/already full/);
  });
});

describe('manual pick', () => {
  it('warns about a condition conflict and over capacity', () => {
    const d = SCENARIOS.find((s) => s.id === 'conflicts')!.build() as BureauData;
    const r = assignAll(d);
    const ned = r.assignments.ned;
    expect(ned.mode).toBe('manual');
    expect(ned.warnings.some((w) => /too bright/i.test(w))).toBe(true);
    expect(ned.warnings.some((w) => w.includes('over capacity'))).toBe(true);
    expect(r.assignments.oswald.warnings.some((w) => w.includes('Deadline'))).toBe(true);

    const rep = buildReport(d, r);
    expect(rep.places.find((p) => p.placeId === 'lighthouse')!.status).toBe('overloaded');
  });

  it('a good manual pick produces no warnings', () => {
    const d = data([ghost()], [place(), place({ id: 'p2', name: 'Closet' })], { g: 'p' });
    expect(assignAll(d).assignments.g.warnings).toEqual([]);
  });

  it('a manual pick takes a place before auto-assignment', () => {
    const d = data(
      [ghost({ id: 'a', deadline: '2026-11-01' }), ghost({ id: 'b', deadline: '2026-11-30' })],
      [place({ capacity: 1 })],
      { b: 'p' },
    );
    const r = assignAll(d);
    expect(r.assignments.b.placeId).toBe('p');
    expect(r.assignments.a.unassignedReason).toBe('ALL_FULL');
  });
});

describe('edge cases after review', () => {
  it('a closed place (capacity 0) is neither suitable nor recommended', () => {
    const d = data([ghost()], [place({ id: 'closed', capacity: 0 }), place({ id: 'open', temperature: 13 })]);
    const r = assignAll(d);
    expect(r.assignments.g.placeId).toBe('open');
    expect(r.assignments.g.recommendedPlaceId).toBe('open');
    expect(r.assignments.g.explanation.join(' ')).not.toMatch(/already full/);
    const closed = r.assignments.g.evaluations.find((e) => e.placeId === 'closed')!;
    expect(closed.ok).toBe(false);
    expect(closed.violations[0].code).toBe('CLOSED');
  });


  it('pluralizes "point"', () => {
    const d = data(
      [ghost({ id: 'a', deadline: '2026-11-01' }), ghost({ id: 'b', deadline: '2026-11-30', favoriteTemp: 14 })],
      [place({ capacity: 1 })],
    );
    expect(assignAll(d).assignments.b.explanation.join(' ')).toMatch(/92 points/);
  });
});

describe('special conditions as in the spec', () => {
  it('a conflict with any condition excludes the place and names the reason', () => {
    const g = ghost({ conditions: ['lovesDamp', 'lovesBooks'] });
    const e = evaluatePlace(g, place({ humidity: 40, features: [] }));
    expect(e.ok).toBe(false);
    expect(e.violations.map((v) => v.text).join(' | ')).toMatch(/too dry: humidity 40%.*no books/);
  });

  it('demo: out of 20, 15 are assigned and five need a decision — all three reasons', () => {
    const r = assignAll(demo());
    expect(Object.values(r.assignments).filter((a) => a.placeId).length).toBe(15);
    const reasons = Object.values(r.assignments).map((a) => a.unassignedReason).filter(Boolean);
    expect(reasons.sort()).toEqual(['ALL_FULL', 'DEADLINE_EXPIRED', 'DEADLINE_EXPIRED', 'NO_SUITABLE_PLACE', 'NO_SUITABLE_PLACE']);
    expect(r.assignments.mary.placeId).toBe('castle');
    expect(r.assignments.keeper.placeId).toBe('library');
  });
});

describe('final report', () => {
  it('demo: 15 assigned, 5 without a place; only real problems among the problem ghosts', () => {
    const d = demo();
    const rep = buildReport(d, assignAll(d));
    expect(rep.settled).toBe(15);
    expect(rep.unsettled).toBe(5);
    expect(rep.byReason).toMatchObject({ DEADLINE_EXPIRED: 2, NO_SUITABLE_PLACE: 2, ALL_FULL: 1 });
    expect(rep.problems.slice(0, 5).every((p) => p.reasons[0].startsWith('Without a place'))).toBe(true);
    // The Keeper is housed in the only suitable place — that is not a problem
    expect(rep.problems.some((p) => p.ghostId === 'keeper')).toBe(false);
    expect(rep.places.some((p) => p.status === 'overloaded')).toBe(false);
  });
});

describe('new requests before automatic assignment', () => {
  it('the demo starts unprocessed: nobody is assigned and no space is taken', () => {
    const d = SCENARIOS.find((s) => s.id === 'demo')!.build() as BureauData;
    const r = assignAll(d);
    expect(Object.values(r.assignments).every((a) => a.mode === 'pending')).toBe(true);
    expect(Object.values(r.occupancy).every((o) => o.length === 0)).toBe(true);
  });

  it('a new request does not take a place from processed ones', () => {
    const d = data([ghost({ id: 'old', deadline: '2026-11-20' }), ghost({ id: 'new', deadline: '2026-11-01' })], [place({ capacity: 1 })]);
    d.processed = ['old'];
    const r = assignAll(d);
    expect(r.assignments.old.placeId).toBe('p');
    expect(r.assignments.new.mode).toBe('pending');
  });

  it('a manual pick also works for an unprocessed request', () => {
    const d = data([ghost()], [place()], { g: 'p' });
    d.processed = [];
    expect(assignAll(d).assignments.g.mode).toBe('manual');
  });
});

describe('explanations and warnings after review', () => {
  it('the explanation names the next best option by score', () => {
    const d = data([ghost()], [place({ id: 'best' }), place({ id: 'second', name: 'Closet', temperature: 12 })]);
    expect(assignAll(d).assignments.g.explanation.join(' ')).toMatch(/Next best by score — Closet \(96\)/);
  });

  it('manual pick of a closed place: one "closed" warning, without a duplicate "over capacity"', () => {
    const d = data([ghost()], [place({ capacity: 0 })], { g: 'p' });
    const w = assignAll(d).assignments.g.warnings;
    expect(w.filter((x) => /closed/.test(x))).toHaveLength(1);
    expect(w.some((x) => /over capacity/.test(x))).toBe(false);
  });

  it('housing beyond capacity does not evict current residents — the place goes over capacity', () => {
    const d = data(
      [ghost({ id: 'a', deadline: '2026-11-01' }), ghost({ id: 'b' })],
      [place({ capacity: 1 }), place({ id: 'p2', name: 'Closet', temperature: 14 })],
      { b: 'p' },
    );
    d.overCapacity = ['b'];
    const r = assignAll(d);
    expect(r.assignments.a.placeId).toBe('p');
    expect(r.assignments.b.placeId).toBe('p');
    expect(r.occupancy.p).toHaveLength(2);
    expect(r.assignments.b.warnings.join(' ')).toMatch(/over capacity: 2/);
  });

  it('demo "Manual conflicts": the theatre residents stay put, the theatre and the lighthouse go over capacity', () => {
    const d = SCENARIOS.find((s) => s.id === 'conflicts')!.build() as BureauData;
    const r = assignAll(d);
    expect(r.assignments.phantom.placeId).toBe('theatre');
    expect(r.occupancy.theatre.length).toBe(3);
    expect(r.occupancy.lighthouse.length).toBe(2);
  });
});
