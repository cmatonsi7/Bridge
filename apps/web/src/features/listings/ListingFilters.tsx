import { useEffect, useState } from 'react';
import {
  AGE_BANDS,
  LISTING_TYPES,
  PROVINCES,
  SPORTS,
  type ListingFilters as Filters,
} from '@sportbridge/shared';

const WIDE = '(min-width: 901px)';
const isWide = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches;

/** Filter panel (prototype .sb-filters). Dropdowns rather than unconnected checkboxes. */
export function ListingFilters({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const select = (
    id: string,
    label: string,
    v: string,
    options: readonly { value: string; label: string }[],
    key: keyof Filters,
    all: string,
  ) => (
    <div className="sb-filter-group">
      <h4>
        <label htmlFor={id}>{label}</label>
      </h4>
      <select
        id={id}
        className="sb-input"
        value={v}
        onChange={(e) => set(key, e.target.value as never)}
        style={{ width: '100%' }}
      >
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
  const asOptions = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));
  const activeCount = [value.sport, value.type, value.province, value.ageBand, value.cost].filter(
    Boolean,
  ).length;
  const active = activeCount > 0;
  // Open on wide screens; folded on phones so results come first.
  const [open, setOpen] = useState(isWide);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(WIDE);
    const onChange = () => mq.matches && setOpen(true);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return (
    <details
      className="sb-card sb-filters"
      aria-label="Filters"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>Filters{activeCount ? ` (${activeCount})` : ''}</summary>
      {select('f-sport', 'Sport', value.sport ?? '', asOptions(SPORTS), 'sport', 'All sports')}
      {select('f-type', 'Type', value.type ?? '', asOptions(LISTING_TYPES), 'type', 'All types')}
      {select(
        'f-province',
        'Province',
        value.province ?? '',
        asOptions(PROVINCES),
        'province',
        'All provinces',
      )}
      {select(
        'f-age',
        'Age',
        value.ageBand ?? '',
        AGE_BANDS.map((b) => ({ value: b.key, label: b.label })),
        'ageBand',
        'All ages',
      )}
      {select(
        'f-cost',
        'Cost',
        value.cost ?? '',
        [
          { value: 'free', label: 'Free' },
          { value: 'paid', label: 'Paid' },
        ],
        'cost',
        'Free and paid',
      )}
      {active && (
        <button
          type="button"
          className="sb-btn"
          onClick={() => onChange({ query: value.query })}
          style={{ width: '100%' }}
        >
          Clear filters
        </button>
      )}
    </details>
  );
}
