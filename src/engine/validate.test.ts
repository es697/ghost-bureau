import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../data/demo';
import { isIsoDate } from './dates';
import type { BureauData } from './types';
import { parseBureauJson } from './validate';

describe('data import and validation', () => {
  it('the demo data passes validation', () => {
    const demo = SCENARIOS.find((s) => s.id === 'demo')!.build();
    expect(parseBureauJson(JSON.stringify(demo)).ok).toBe(true);
  });

  it('non-JSON gives a clear error', () => {
    const r = parseBureauJson('{ ghosts: ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/not valid JSON/);
  });

  it('a broken file: lists the specific problems', () => {
    const raw = SCENARIOS.find((s) => s.id === 'broken')!.build() as string;
    const r = parseBureauJson(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const all = r.errors.join('\n');
    expect(all).toMatch(/Anxiety must be an integer from 1 to 10/);
    expect(all).toMatch(/Deadline/);
    expect(all).toMatch(/Unknown special condition/);
    expect(all).toMatch(/is duplicated/);
    expect(all).toMatch(/Enter a name/);
  });

  it('strict date checking', () => {
    expect(isIsoDate('2026-10-31')).toBe(true);
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('31.10.2026')).toBe(false);
  });
});

describe('validation after review', () => {
  const base = () => SCENARIOS.find((s) => s.id === 'demo')!.build() as BureauData;

  it('rejects duplicate conditions and features', () => {
    const d = base();
    d.ghosts[0].conditions = ['lovesBooks', 'lovesBooks'];
    d.places[0].features = ['attic', 'attic'];
    const r = parseBureauJson(JSON.stringify(d));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/listed twice[\s\S]*listed twice/);
  });

  it('the same id on a request and a place is allowed', () => {
    const d = base();
    d.ghosts[0].id = 'castle';
    const r = parseBureauJson(JSON.stringify(d));
    expect(r.ok).toBe(true);
  });

  it('a fractional temperature is rejected', () => {
    const d = base();
    d.ghosts[0].favoriteTemp = 10.3;
    const r = parseBureauJson(JSON.stringify(d));
    expect(r.ok).toBe(false);
  });
});

it('temperatures from −90 to +60 are allowed, outside that is an error', () => {
  const d = SCENARIOS.find((s) => s.id === 'demo')!.build() as BureauData;
  d.ghosts[0].favoriteTemp = -90;
  d.places[0].temperature = 60;
  expect(parseBureauJson(JSON.stringify(d)).ok).toBe(true);
  d.ghosts[0].favoriteTemp = -91;
  expect(parseBureauJson(JSON.stringify(d)).ok).toBe(false);
});
