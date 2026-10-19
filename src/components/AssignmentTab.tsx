import { useState, type CSSProperties } from 'react';
import { daysBetween, deadlineText, formatDate } from '../engine/dates';
import { plural, type Assignment, type MatchResult, type UnassignedReason } from '../engine/match';
import { REASON_LABELS } from '../engine/report';
import { CONDITIONS, CONDITION_IDS, RULES } from '../engine/rules';
import type { BureauData, Ghost, Place } from '../engine/types';
import { FilterBar, matches } from './FilterBar';
import { GhostAvatar } from './GhostAvatar';
import { Empty, Score } from './ui';

/** How full a place is as seen by one particular request (which is not counted itself) */
function seatsLabel(p: Place, others: number): string {
  if (p.capacity === 0) return 'closed';
  const free = p.capacity - others;
  return free > 0 ? `${free} of ${p.capacity} free` : `no seats, ${others}/${p.capacity}`;
}

export type Filter = 'pending' | 'unsettled' | 'settled' | 'all';

/** The order follows the operator's path: new → those needing a decision → assigned */
const FILTERS: { id: Filter; label: string; test: (a: Assignment) => boolean }[] = [
  { id: 'pending', label: 'New', test: (a) => a.mode === 'pending' },
  { id: 'unsettled', label: 'Needs your decision', test: (a) => !!a.unassignedReason },
  { id: 'settled', label: 'Assigned', test: (a) => a.placeId !== null },
  { id: 'all', label: 'All', test: () => true },
];

/** Which list to start from: the one where the operator is needed most */
export function defaultFilter(result: MatchResult): Filter {
  const all = Object.values(result.assignments);
  if (all.some((a) => a.mode === 'pending')) return 'pending';
  if (all.some((a) => a.unassignedReason)) return 'unsettled';
  return 'settled';
}

interface Props {
  data: BureauData;
  result: MatchResult;
  onAdd: () => void;
  onEdit: (g: Ghost) => void;
  onDelete: (g: Ghost) => void;
  onOverride: (ghostId: string, placeId: string | null) => void;
  onResetOverrides: () => void;
  onLoadDemo: () => void;
  onOpenPlaces: () => void;
  onReject: (g: Ghost) => void;
  onRunAuto: () => void;
  filter: Filter;
  onFilter: (f: Filter) => void;
}

export function AssignmentTab({
  data,
  result,
  onAdd,
  onEdit,
  onDelete,
  onOverride,
  onResetOverrides,
  onLoadDemo,
  onOpenPlaces,
  onReject,
  onRunAuto,
  filter: requestedFilter,
  onFilter: setFilter,
}: Props) {
  let filter = requestedFilter;
  const [query, setQuery] = useState('');
  const [condition, setCondition] = useState('');
  const count = (f: Filter) => result.order.filter((id) => FILTERS.find((x) => x.id === f)!.test(result.assignments[id])).length;
  const pendingCount = count('pending');
  const unsettledCount = count('unsettled');
  const placesById = new Map(data.places.map((p) => [p.id, p]));
  const ghostsById = new Map(data.ghosts.map((g) => [g.id, g]));
  const manualCount = Object.keys(data.overrides).length;

  if (data.ghosts.length === 0) {
    return (
      <Empty icon="🕯️" title="No requests yet">
        <p>Not a single ghost is asking to move. Silence… suspicious.</p>
        <div className="row-actions">
          <button className="btn btn-primary" onClick={onAdd}>
            + Add request
          </button>
          <button className="btn" onClick={onLoadDemo}>
            Load demo bureau
          </button>
        </div>
      </Empty>
    );
  }

  // The "New" chip is hidden when there are no new ones — then we show the next most important list
  if (filter === 'pending' && pendingCount === 0) filter = unsettledCount > 0 ? 'unsettled' : 'settled';
  const active = FILTERS.find((f) => f.id === filter)!;
  const inList = result.order.filter((id) => active.test(result.assignments[id]));
  // Search by ghost name or by the place it was assigned to; filter by special condition
  const visible = inList.filter((id) => {
    const g = ghostsById.get(id)!;
    const pid = result.assignments[id].placeId;
    if (condition && !g.conditions.includes(condition as Ghost['conditions'][number])) return false;
    return matches(query, g.name, pid ? placesById.get(pid)!.name : undefined);
  });
  const searching = query.trim() !== '' || condition !== '';
  const resetSearch = () => {
    setQuery('');
    setCondition('');
  };

  return (
    <section>
      {pendingCount > 0 && (
        <div className="autorun panel">
          <div className="autorun-text">
            <b>📥 New requests: {pendingCount}.</b> The bureau has not looked for places for them yet. Run the automatic
            assignment — anyone it cannot place will be shown separately with a reason.
          </div>
          <button className="btn btn-primary autorun-btn" onClick={onRunAuto}>
            ▶ Assign automatically
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="chips" role="tablist" aria-label="Request filter">
          {FILTERS.filter((f) => f.id !== 'pending' || pendingCount > 0).map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={`chip ${filter === f.id ? 'chip-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}{' '}
              <b className={f.id === 'unsettled' && unsettledCount > 0 ? 'chip-alarm' : ''}>{count(f.id)}</b>
            </button>
          ))}
        </div>
        <div className="row-actions">
          {manualCount > 0 && (
            <button className="btn" onClick={onResetOverrides} title="Hand every decision back to the algorithm">
              ↺ Reset manual ({manualCount})
            </button>
          )}
          <button className="btn btn-primary" onClick={onAdd}>
            + Request
          </button>
        </div>
      </div>

      <FilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Ghost name or place"
        selects={[
          {
            label: 'Condition',
            value: condition,
            onChange: setCondition,
            options: [{ value: '', label: 'any' }, ...CONDITION_IDS.map((id) => ({ value: id, label: CONDITIONS[id].label }))],
          },
        ]}
        found={visible.length}
        total={inList.length}
        onReset={resetSearch}
      />

      <FormulaHelp />

      {filter === 'unsettled' && visible.length > 0 && (
        <p className="queue-hint">
          <b>These are the requests the bureau could not find a place for — they need your decision.</b> Each card gives the reason and what
          you can do. Once a ghost gets a place, it moves to "Assigned".
        </p>
      )}

      {visible.length === 0 && searching ? (
        <div className="alert alert-info">
          <strong>Nothing found in the "{active.label}" list.</strong> Try another name or reset the filter.
          <div className="row-actions" style={{ marginTop: 6 }}>
            <button className="btn btn-small" onClick={resetSearch}>
              Reset search
            </button>
          </div>
        </div>
      ) : visible.length === 0 && filter === 'unsettled' ? (
        <div className="alert alert-info">
          <strong>Every ghost is assigned — the operator is not needed.</strong>
          <div className="row-actions" style={{ marginTop: 6 }}>
            <button className="btn btn-small" onClick={() => setFilter('settled')}>
              View assigned ghosts
            </button>
          </div>
        </div>
      ) : visible.length === 0 && filter === 'pending' ? (
        <p className="muted pad">No new requests — they have all gone through assignment.</p>
      ) : visible.length === 0 ? (
        <p className="muted pad">There are no requests in this list.</p>
      ) : (
        <ol className="ghost-list">
          {visible.map((id, i) => (
            <GhostCard
              key={id}
              index={result.order.indexOf(id) + 1}
              ghost={ghostsById.get(id)!}
              a={result.assignments[id]}
              data={data}
              placesById={placesById}
              occupancy={result.occupancy}
              onEdit={onEdit}
              onDelete={onDelete}
              onOverride={onOverride}
              onOpenPlaces={onOpenPlaces}
              onReject={onReject}
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function GhostCard({
  index,
  ghost: g,
  a,
  data,
  placesById,
  occupancy,
  onEdit,
  onDelete,
  onOverride,
  onOpenPlaces,
  onReject,
  style,
}: {
  index: number;
  ghost: Ghost;
  a: Assignment;
  data: BureauData;
  placesById: Map<string, Place>;
  occupancy: Record<string, string[]>;
  onEdit: (g: Ghost) => void;
  onDelete: (g: Ghost) => void;
  onOverride: (ghostId: string, placeId: string | null) => void;
  onOpenPlaces: () => void;
  onReject: (g: Ghost) => void;
  style: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const place = a.placeId ? placesById.get(a.placeId) : undefined;
  const days = daysBetween(data.today, g.deadline);
  const status = a.mode === 'pending' ? 'pending' : a.mode === 'none' ? 'none' : a.warnings.length ? 'warn' : 'ok';
  // What to show next to "Auto": the algorithm's actual decision, not the ideal without capacity limits
  const autoLabel =
    a.mode === 'auto'
      ? `: ${place!.name}`
      : a.mode === 'none'
        ? ': no place'
        : a.mode === 'pending'
          ? ' — after assignment'
          : ' — re-evaluate';

  return (
    <li className={`ghost-card panel status-${status}`} style={style}>
      <div className="ghost-head">
        <div className="ghost-title">
          <GhostAvatar ghost={g} size={20} expired={days < 0} />
          <h3>{g.name}</h3>
          <span className="ghost-index" title="Order in which the algorithm processes it">
            #{index}
          </span>
          {a.mode === 'manual' && <span className="tag tag-manual">manual</span>}
        </div>
        <div className="row-actions">
          <button className="btn btn-small" onClick={() => onEdit(g)} aria-label={`Edit request ${g.name}`}>
            ✏️
          </button>
          <button className="btn btn-small btn-danger" onClick={() => onDelete(g)} aria-label={`Delete request ${g.name}`}>
            🗑️
          </button>
        </div>
      </div>

      <div className="ghost-body">
      <GhostAvatar ghost={g} size={64} expired={days < 0} />
      <div className="ghost-info">
      <dl className="ghost-stats">
        <div>
          <dt>Anxiety</dt>
          <dd>
            <span className="anx" style={{ ['--anx' as string]: g.anxiety }}>
              {g.anxiety}/10
            </span>
          </dd>
        </div>
        <div>
          <dt>Prefers</dt>
          <dd>{g.favoriteTemp}°C</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd className={days < 0 ? 'text-bad' : days <= 2 ? 'text-warn' : ''}>
            {formatDate(g.deadline)} · {deadlineText(data.today, g.deadline)}
          </dd>
        </div>
      </dl>
      {(g.conditions.length > 0 || g.note) && (
        <div className="conditions">
          {g.conditions.map((c) => (
            <span key={c} className="tag tag-hard">
              {CONDITIONS[c].label}
            </span>
          ))}
          {g.note && <span className="note">“{g.note}”</span>}
        </div>
      )}
      </div>
      </div>

      <div className="verdict">
        {a.mode === 'pending' ? (
          <div className="verdict-place verdict-pending">
            <span aria-hidden>⏳</span>
            <strong>Not processed</strong>
          </div>
        ) : place ? (
          <div className="verdict-place">
            <span className="arrow" aria-hidden>
              ➜
            </span>
            <span className="place-emoji" aria-hidden>
              {place.emoji}
            </span>
            <strong>{place.name}</strong>
            <Score value={a.score} />
          </div>
        ) : (
          <div className="verdict-place verdict-none">
            <span aria-hidden>☠️</span>
            <strong>No place: {REASON_LABELS[a.unassignedReason!]}</strong>
          </div>
        )}

        <label className="override">
          <span className="sr-only">Place for {g.name}</span>
          <select
            value={data.overrides[g.id] ?? ''}
            onChange={(e) => onOverride(g.id, e.target.value || null)}
            disabled={data.places.length === 0}
          >
            <option value="">⚙️ Auto{autoLabel}</option>
            {a.evaluations.map((ev) => {
              const p = placesById.get(ev.placeId)!;
              // Occupancy goes right after the name and on every place, including unsuitable ones:
              // at the end of the line it was cut off for long names
              const seats = seatsLabel(p, occupancy[p.id].filter((x) => x !== g.id).length);
              const label = ev.ok
                ? `${p.emoji} ${p.name} [${seats}] — ${ev.score} pts`
                : `✕ ${p.name} [${seats}] — ${ev.violations[0].text}`;
              return (
                <option key={p.id} value={p.id}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {a.mode !== 'none' && <p className="why">{a.explanation.join(' ')}</p>}
      {a.mode === 'none' && (
        <div className="alert alert-bad" role="status">
          <strong>{a.explanation[0]}</strong>
          {(a.unassignedReason === 'NO_SUITABLE_PLACE' || a.unassignedReason === 'ALL_FULL') && (
            // We build the per-place breakdown from the final load: inside the core explanation it is intermediate
            <ul>
              {a.evaluations
                .filter((ev) => (a.unassignedReason === 'ALL_FULL' ? ev.ok : true))
                .map((ev) => {
                  const p = placesById.get(ev.placeId)!;
                  const seats = seatsLabel(p, occupancy[p.id].filter((x) => x !== g.id).length);
                  return (
                    <li key={p.id}>
                      {p.name} <span className="seats">[{seats}]</span>
                      {ev.ok ? ` — ${ev.score} ${plural(ev.score, 'point', 'points', 'points')}` : `: ${ev.violations.map((v) => v.text).join('; ')}`}
                    </li>
                  );
                })}
            </ul>
          )}
          <NextStep reason={a.unassignedReason!} onReject={() => onReject(g)} onOpenPlaces={onOpenPlaces} />
        </div>
      )}
      {a.warnings.length > 0 && (
        <div className="alert alert-warn" role="alert">
          <strong>⚠️ The manual pick breaks the requirements:</strong>
          <ul>
            {a.warnings.map((w, i) => (
              <li key={`${i}-${w}`}>{w}</li>
            ))}
          </ul>
          <button className="btn btn-small" onClick={() => onOverride(g.id, null)}>
            ↺ Restore automatic pick
          </button>
        </div>
      )}

      <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '▾ Hide place comparison' : '▸ Compare all places'}
      </button>
      {open && <Comparison a={a} placesById={placesById} occupancy={occupancy} />}
    </li>
  );
}

/**
 * What the operator can do with a request that has no place — depending on the specific reason.
 * We do not bend the request to fit a place: conditions and deadline are the client's needs.
 * The operator is in charge of the bureau's places and of the placement decisions.
 */
function NextStep({
  reason,
  onReject,
  onOpenPlaces,
}: {
  reason: UnassignedReason;
  onReject: () => void;
  onOpenPlaces: () => void;
}) {
  const tips: Record<UnassignedReason, { text: string; action: string; onClick: () => void }> = {
    DEADLINE_EXPIRED: {
      text: 'Assign it manually late using the list above — the system will warn you — or reject the request.',
      action: '✕ Reject request',
      onClick: onReject,
    },
    NO_SUITABLE_PLACE: {
      text: 'Pick a place manually in the list above — the bureau will show which requirements would be broken. Or add a suitable place.',
      action: '🏚️ Open places',
      onClick: onOpenPlaces,
    },
    ALL_FULL: {
      text: 'Increase the capacity of a suitable place, or move the ghost in over capacity using the list above.',
      action: '🏚️ Open places',
      onClick: onOpenPlaces,
    },
    NO_PLACES: {
      text: 'Add at least one relocation place.',
      action: '🏚️ Open places',
      onClick: onOpenPlaces,
    },
  };
  const t = tips[reason];
  return (
    <div className="next-step">
      <span>
        <b>What you can do:</b> {t.text}
      </span>
      <button className="btn btn-small" onClick={t.onClick}>
        {t.action}
      </button>
    </div>
  );
}

function Comparison({
  a,
  placesById,
  occupancy,
}: {
  a: Assignment;
  placesById: Map<string, Place>;
  occupancy: Record<string, string[]>;
}) {
  if (a.evaluations.length === 0) return <p className="muted">The bureau has no places.</p>;
  return (
    <div className="table-wrap">
      <table className="compare">
        <thead>
          <tr>
            <th>Place</th>
            <th>Score</th>
            <th>Occupied</th>
            <th>Breakdown</th>
          </tr>
        </thead>
        <tbody>
          {a.evaluations.map((ev) => {
            const p = placesById.get(ev.placeId)!;
            const occ = occupancy[p.id].length;
            return (
              <tr key={p.id} className={ev.placeId === a.placeId ? 'row-chosen' : ev.ok ? '' : 'row-rejected'}>
                <td>
                  {p.emoji} {p.name}
                </td>
                <td>{ev.ok ? <Score value={ev.score} /> : <span className="text-bad">✕</span>}</td>
                <td className={occ > p.capacity ? 'text-bad' : ''}>
                  {occ}/{p.capacity}
                </td>
                <td>
                  {ev.ok ? (
                    <>
                      {ev.pros.length > 0 && <span className="text-good">+ {ev.pros.join(', ')}. </span>}
                      {ev.penalties.map((x) => `−${x.points} ${x.label.toLowerCase()}`).join('; ') || 'no penalties'}
                    </>
                  ) : (
                    <span className="text-bad">{ev.violations.map((v) => v.text).join('; ')}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FormulaHelp() {
  return (
    <details className="formula panel">
      <summary>📜 How the score works and who gets a place first</summary>
      <div className="formula-body">
        <p>
          <b>1. Hard requirements</b> — if even one is broken, the place does not fit at all:
        </p>
        <ul>
          <li>light level ≤ 10 − anxiety (anxious ghosts need darkness);</li>
          <li>temperature differs from the preferred one by no more than {RULES.maxTempDiff}°;</li>
          <li>the place's anxiety cap;</li>
          <li>special conditions on the request: attic, basement, no mirrors, no humans, silence, damp, books;</li>
          <li>the deadline has not passed.</li>
        </ul>
        <p>
          <b>2. Score</b> = 100 − {RULES.tempPenaltyPerDegree}×|Δt°| − {RULES.lightPenaltyPerUnit}×light − noise×anxiety/
          {RULES.noiseDivisor}.
        </p>
        <p>
          <b>3. Queue</b>: manual operator decisions first, then requests in order of "earlier deadline → fewer suitable
          places → higher anxiety". Each one gets the best place that still has free seats. The #N on a card is its
          position in the queue.
        </p>
      </div>
    </details>
  );
}
