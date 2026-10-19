/** Case-insensitive search */
export const normalize = (s: string) => s.toLowerCase().trim();
export const matches = (query: string, ...texts: (string | undefined)[]) => {
  const q = normalize(query);
  return !q || texts.some((t) => t && normalize(t).includes(q));
};

export interface FilterSelect {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

/** Search and filter bar above a list: text input, dropdowns, "found N of M" */
export function FilterBar({
  query,
  onQuery,
  placeholder,
  selects,
  found,
  total,
  onReset,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  selects: FilterSelect[];
  found: number;
  total: number;
  onReset: () => void;
}) {
  const active = query.trim() !== '' || selects.some((s) => s.value !== '');
  return (
    <div className="filter-bar" role="search">
      <label className="filter-search">
        <span aria-hidden>🔍</span>
        <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </label>
      {selects.map((s) => (
        <label key={s.label} className="filter-select">
          <span>{s.label}:</span>
          <select value={s.value} onChange={(e) => s.onChange(e.target.value)}>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {active && (
        <span className="filter-found">
          Found {found} of {total}
          <button className="btn btn-small" onClick={onReset}>
            Reset
          </button>
        </span>
      )}
    </div>
  );
}
