import { isIsoDate } from './dates';
import { CONDITION_IDS, FEATURE_IDS } from './rules';
import type { BureauData, Ghost, Place } from './types';

export type FieldErrors = Record<string, string>;

/** Allowed temperatures, °C: from polar night to desert */
export const TEMP_MIN = -90;
export const TEMP_MAX = 60;

const isInt = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const hasDuplicates = (list: unknown[]) => new Set(list).size !== list.length;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Field errors for a request (used by both the form and the import) */
export function validateGhost(g: Record<string, unknown>): FieldErrors {
  const e: FieldErrors = {};
  if (typeof g.name !== 'string' || !g.name.trim()) e.name = 'Enter a name';
  else if (g.name.length > 40) e.name = 'Name is longer than 40 characters';
  if (!isInt(g.anxiety, 1, 10)) e.anxiety = 'Anxiety must be an integer from 1 to 10';
  if (!isInt(g.favoriteTemp, TEMP_MIN, TEMP_MAX)) e.favoriteTemp = `Temperature must be an integer from ${TEMP_MIN} to +${TEMP_MAX} °C`;
  if (!isIsoDate(g.deadline)) e.deadline = 'Deadline must be a date in YYYY-MM-DD format';
  if (!Array.isArray(g.conditions) || g.conditions.some((c) => !CONDITION_IDS.includes(c)))
    e.conditions = `Unknown special condition. Allowed: ${CONDITION_IDS.join(', ')}`;
  else if (hasDuplicates(g.conditions)) e.conditions = 'Special condition listed twice';
  if (g.note !== undefined && typeof g.note !== 'string') e.note = 'Note must be a string';
  return e;
}

export function validatePlace(p: Record<string, unknown>): FieldErrors {
  const e: FieldErrors = {};
  if (typeof p.name !== 'string' || !p.name.trim()) e.name = 'Enter a name';
  else if (p.name.length > 50) e.name = 'Name is longer than 50 characters';
  if (typeof p.emoji !== 'string') e.emoji = 'Emoji must be a string';
  if (!isInt(p.capacity, 0, 50)) e.capacity = 'Capacity must be an integer from 0 to 50';
  if (!isInt(p.light, 0, 10)) e.light = 'Light must be an integer from 0 to 10';
  if (!isInt(p.noise, 0, 10)) e.noise = 'Noise must be an integer from 0 to 10';
  if (!isInt(p.humidity, 0, 100)) e.humidity = 'Humidity must be an integer from 0 to 100 %';
  if (!isInt(p.temperature, TEMP_MIN, TEMP_MAX)) e.temperature = `Temperature must be an integer from ${TEMP_MIN} to +${TEMP_MAX} °C`;
  if (typeof p.hasHumans !== 'boolean') e.hasHumans = 'The "has humans" field must be true/false';
  if (!Array.isArray(p.features) || p.features.some((f) => !FEATURE_IDS.includes(f)))
    e.features = `Unknown place feature. Allowed: ${FEATURE_IDS.join(', ')}`;
  else if (hasDuplicates(p.features)) e.features = 'Feature listed twice';
  if (p.maxAnxiety !== null && !isInt(p.maxAnxiety, 1, 10))
    e.maxAnxiety = 'Anxiety limit must be an integer from 1 to 10 or empty';
  if (p.note !== undefined && typeof p.note !== 'string') e.note = 'Note must be a string';
  return e;
}

export type ParseResult = { ok: true; data: BureauData } | { ok: false; errors: string[] };

const MAX_ERRORS = 8;

/** Full check of bureau data: for JSON import and localStorage loading */
export function validateBureauData(raw: unknown): ParseResult {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['Expected a JSON object with the fields today, ghosts, places, overrides.'] };

  if (!isIsoDate(raw.today)) errors.push('The today field must be a YYYY-MM-DD date.');
  if (!Array.isArray(raw.ghosts)) errors.push('The ghosts field must be an array of requests.');
  if (!Array.isArray(raw.places)) errors.push('The places field must be an array of places.');
  if (raw.overrides !== undefined && !isObj(raw.overrides)) errors.push('The overrides field must be an object.');
  if (raw.processed !== undefined && (!Array.isArray(raw.processed) || raw.processed.some((x) => typeof x !== 'string')))
    errors.push('The processed field must be a list of request ids.');
  if (errors.length) return { ok: false, errors };

  const ghosts = raw.ghosts as unknown[];
  const places = raw.places as unknown[];

  // ids are unique within their own list: a request and a place may share an id, they live in different collections
  const check = (list: unknown[], kind: 'Request' | 'Place', fn: (x: Record<string, unknown>) => FieldErrors) => {
    const ids = new Set<string>();
    list.forEach((item, i) => {
      if (!isObj(item)) {
        errors.push(`${kind} #${i + 1}: expected an object.`);
        return;
      }
      const label = typeof item.name === 'string' && item.name ? `"${item.name}"` : `#${i + 1}`;
      if (typeof item.id !== 'string' || !item.id) errors.push(`${kind} ${label}: missing id.`);
      else if (ids.has(item.id)) errors.push(`${kind} ${label}: id "${item.id}" is duplicated.`);
      else ids.add(item.id);
      for (const msg of Object.values(fn(item))) errors.push(`${kind} ${label}: ${msg}.`);
    });
  };
  check(ghosts, 'Request', validateGhost);
  check(places, 'Place', validatePlace);

  const overrides: Record<string, string> = {};
  if (isObj(raw.overrides)) {
    const ghostIds = new Set(ghosts.filter(isObj).map((g) => g.id));
    const placeIds = new Set(places.filter(isObj).map((p) => p.id));
    for (const [gid, pid] of Object.entries(raw.overrides)) {
      if (!ghostIds.has(gid)) errors.push(`A manual override points to a nonexistent request "${gid}".`);
      else if (typeof pid !== 'string' || !placeIds.has(pid))
        errors.push(`The manual override for "${gid}" points to a nonexistent place "${String(pid)}".`);
      else overrides[gid] = pid;
    }
  }

  // Files without processed (the old format) count as fully processed; unknown ids are simply dropped
  const ghostIdList = ghosts.filter(isObj).map((g) => g.id as string);
  const processed = Array.isArray(raw.processed)
    ? (raw.processed as string[]).filter((id) => ghostIdList.includes(id))
    : ghostIdList;

  if (raw.overCapacity !== undefined && (!Array.isArray(raw.overCapacity) || raw.overCapacity.some((x) => typeof x !== 'string')))
    errors.push('The overCapacity field must be a list of request ids.');
  const overCapacity = Array.isArray(raw.overCapacity) ? (raw.overCapacity as string[]).filter((id) => id in overrides) : [];

  if (errors.length) {
    const extra = errors.length - MAX_ERRORS;
    return { ok: false, errors: extra > 0 ? [...errors.slice(0, MAX_ERRORS), `…and ${extra} more.`] : errors };
  }
  return {
    ok: true,
    data: {
      today: raw.today as string,
      ghosts: ghosts as Ghost[],
      places: places as Place[],
      overrides,
      processed,
      overCapacity,
    },
  };
}

/** JSON string -> bureau data with human-readable errors */
export function parseBureauJson(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`Data is not valid JSON: ${(err as Error).message}`] };
  }
  return validateBureauData(raw);
}
