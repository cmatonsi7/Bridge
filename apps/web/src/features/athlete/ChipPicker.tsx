interface Props<T extends string> {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  max?: number;
  error?: string;
  id: string;
}

/** Multi-select from a fixed list, using the prototype's pill styling. */
export function ChipPicker<T extends string>({ label, options, value, onChange, max, error, id }: Props<T>) {
  const atMax = max !== undefined && value.length >= max;
  const toggle = (o: T) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <div className="sb-field full" role="group" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`}>
        {label}
        {max !== undefined && (
          <span style={{ fontWeight: 600, color: '#6b7a71' }}>
            {' '}
            ({value.length}/{max})
          </span>
        )}
      </label>
      <div className="sb-pill-row">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              className="sb-chip"
              aria-pressed={on}
              disabled={!on && atMax}
              onClick={() => toggle(o)}
            >
              {o}
            </button>
          );
        })}
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
