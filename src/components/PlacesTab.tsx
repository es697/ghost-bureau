import { useState } from 'react';
import type { MatchResult } from '../engine/match';
import { FEATURES, FEATURE_IDS } from '../engine/rules';
import type { BureauData, Place } from '../engine/types';
import { FilterBar, matches } from './FilterBar';
import { GhostAvatar } from './GhostAvatar';
import { Empty, Meter } from './ui';

interface Props {
  data: BureauData;
  result: MatchResult;
  onAdd: () => void;
  onEdit: (p: Place) => void;
}

type Seats = 'free' | 'full' | 'over' | 'closed';

const SEATS_OPTIONS: { value: '' | Seats; label: string }[] = [
  { value: '', label: 'any' },
  { value: 'free', label: 'has free seats' },
  { value: 'full', label: 'occupied' },
  { value: 'over', label: 'over capacity' },
  { value: 'closed', label: 'closed' },
];

function seatsOf(p: Place, occupants: number): Seats {
  if (p.capacity === 0) return occupants > 0 ? 'over' : 'closed';
  if (occupants > p.capacity) return 'over';
  return occupants === p.capacity ? 'full' : 'free';
}

export function PlacesTab({ data, result, onAdd, onEdit }: Props) {
  const ghostById = new Map(data.ghosts.map((g) => [g.id, g]));
  const [query, setQuery] = useState('');
  const [seats, setSeats] = useState('');
  const [feature, setFeature] = useState('');

  if (data.places.length === 0) {
    return (
      <Empty icon="🏚️" title="No relocation places">
        <p>Without places nobody can be relocated — every request will end up "no place".</p>
        <button className="btn btn-primary" onClick={onAdd}>
          + Add place
        </button>
      </Empty>
    );
  }

  // Search by place name or resident name; filters by free seats and place features
  const visible = data.places.filter((p) => {
    const occupants = result.occupancy[p.id] ?? [];
    if (seats && seatsOf(p, occupants.length) !== seats) return false;
    if (feature && !p.features.includes(feature as Place['features'][number])) return false;
    return matches(query, p.name, ...occupants.map((id) => ghostById.get(id)?.name));
  });
  const resetSearch = () => {
    setQuery('');
    setSeats('');
    setFeature('');
  };

  return (
    <section>
      <div className="toolbar">
        <p className="muted">Place parameters affect assignment the moment they are saved.</p>
        <button className="btn btn-primary" onClick={onAdd}>
          + Place
        </button>
      </div>
      <FilterBar
        query={query}
        onQuery={setQuery}
        placeholder="Place name or resident"
        selects={[
          { label: 'Seats', value: seats, onChange: setSeats, options: SEATS_OPTIONS },
          {
            label: 'Feature',
            value: feature,
            onChange: setFeature,
            options: [{ value: '', label: 'any' }, ...FEATURE_IDS.map((id) => ({ value: id, label: FEATURES[id] }))],
          },
        ]}
        found={visible.length}
        total={data.places.length}
        onReset={resetSearch}
      />
      {visible.length === 0 && (
        <div className="alert alert-info">
          <strong>No place matches your search.</strong> Try another name or reset the filters.
          <div className="row-actions" style={{ marginTop: 6 }}>
            <button className="btn btn-small" onClick={resetSearch}>
              Reset search
            </button>
          </div>
        </div>
      )}
      <div className="place-grid">
        {visible.map((p) => {
          const occupants = result.occupancy[p.id] ?? [];
          const over = occupants.length > p.capacity;
          const full = !over && p.capacity > 0 && occupants.length === p.capacity;
          return (
            <article key={p.id} className={`place-card panel ${over ? 'status-warn' : ''}`}>
              <header className="ghost-head">
                <div className="ghost-title">
                  <span className="place-emoji big" aria-hidden>
                    {p.emoji}
                  </span>
                  <h3>{p.name}</h3>
                </div>
                <div className="row-actions">
                  <button className="btn btn-small" onClick={() => onEdit(p)} aria-label={`Edit place ${p.name}`}>
                    ✏️
                  </button>
                </div>
              </header>

              <div className="capacity">
                <span>
                  Occupied <b className={over ? 'text-bad' : ''}>{occupants.length}</b> of {p.capacity}
                </span>
                {over && <span className="tag tag-hard">OVER CAPACITY</span>}
                {full && <span className="tag tag-soft">occupied</span>}
                {p.capacity === 0 && <span className="tag">closed</span>}
              </div>
              <Meter value={occupants.length} max={p.capacity} danger={over} />

              <dl className="params">
                <div>
                  <dt>💡 Light</dt>
                  <dd>{p.light}/10</dd>
                </div>
                <div>
                  <dt>🔊 Noise</dt>
                  <dd>{p.noise}/10</dd>
                </div>
                <div>
                  <dt>💧 Damp</dt>
                  <dd>{p.humidity}%</dd>
                </div>
                <div>
                  <dt>🌡️ Temp.</dt>
                  <dd>{p.temperature}°</dd>
                </div>
                <div>
                  <dt>🧍 Humans</dt>
                  <dd className={p.hasHumans ? 'text-warn' : ''}>{p.hasHumans ? 'yes' : 'no'}</dd>
                </div>
                <div>
                  <dt>⛔ Anxiety</dt>
                  <dd>{p.maxAnxiety === null ? 'any' : `≤ ${p.maxAnxiety}`}</dd>
                </div>
              </dl>
              {p.features.length > 0 && (
                <div className="conditions">
                  {p.features.map((f) => (
                    <span key={f} className="tag">
                      {FEATURES[f]}
                    </span>
                  ))}
                </div>
              )}
              {p.note && <p className="note">“{p.note}”</p>}
              {occupants.length > 0 && (
                <ul className="occupants">
                  {occupants.map((id) => {
                    const g = ghostById.get(id)!;
                    return (
                      <li key={id} title={g.name}>
                        <GhostAvatar ghost={g} size={32} />
                        <span>{g.name}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
