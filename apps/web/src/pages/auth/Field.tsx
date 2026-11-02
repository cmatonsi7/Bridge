import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface Common {
  id: string;
  label: string;
  error?: string;
}

/** Prototype .form-field with an accessible label and inline error. */
export function TextField({ id, label, error, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function SelectField({
  id,
  label,
  error,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
