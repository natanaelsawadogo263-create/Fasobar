import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

const labelClassName = "block text-sm font-medium text-slate-700";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  compact?: boolean;
};

export function FormSection({
  title,
  description,
  children,
  compact = false,
}: FormSectionProps) {
  return (
    <section className={compact ? "space-y-2" : "space-y-4"}>
      <div>
        <h3
          className={
            compact
              ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              : "text-sm font-semibold text-slate-900"
          }
        >
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
};

type TextFieldProps = FieldProps & InputHTMLAttributes<HTMLInputElement>;

export function TextField({
  id,
  label,
  hint,
  error,
  className,
  type,
  ...props
}: TextFieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${inputClassName}${type === "number" ? " input-no-spinner" : ""}`}
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = FieldProps & SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function SelectField({
  id,
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${inputClassName} appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type PriceFieldProps = Omit<TextFieldProps, "type">;

export function PriceField({ id, label, hint, error, className, ...props }: PriceFieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`${inputClassName} input-no-spinner pr-16`}
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-medium text-slate-400"
        >
          F CFA
        </span>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type NumberFieldProps = Omit<TextFieldProps, "type">;

export function NumberField(props: NumberFieldProps) {
  return (
    <TextField
      type="number"
      inputMode="numeric"
      min={0}
      {...props}
    />
  );
}

type ToggleFieldProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
};

export function ToggleField({
  id,
  label,
  description,
  checked,
  onChange,
  name,
}: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[12px] font-medium text-slate-900">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-emerald-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      {name ? (
        <input type="hidden" name={name} value={checked ? "on" : "off"} />
      ) : null}
    </div>
  );
}
