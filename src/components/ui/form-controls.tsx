import { ChevronDown, ChevronUp } from "lucide-react";
import {
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type WheelEvent,
} from "react";

const defaultInputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

function scrollInvalidFieldIntoView(element: HTMLElement) {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

const labelClassName = "block text-sm font-medium text-slate-700";

export function blockNumberWheel(event: WheelEvent<HTMLInputElement>) {
  event.currentTarget.blur();
}

function parseNumericStep(step: InputHTMLAttributes<HTMLInputElement>["step"]): number {
  if (step === undefined || step === "any") return 1;
  const value = Number(step);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function parseBound(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nudgeNumericValue(
  current: string,
  direction: 1 | -1,
  step: number,
  min?: number,
  max?: number,
): string {
  const base = current.trim() === "" ? 0 : Number(current);
  const start = Number.isFinite(base) ? base : 0;
  let next = start + direction * step;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  const decimals = String(step).includes(".") ? (String(step).split(".")[1]?.length ?? 0) : 0;
  return String(Number(next.toFixed(Math.max(decimals, 0))));
}

type StepperNumberInputProps = InputHTMLAttributes<HTMLInputElement> & {
  inputClassName?: string;
  suffix?: string;
};

export function StepperNumberInput({
  inputClassName,
  suffix,
  className,
  onChange,
  onWheel,
  min,
  max,
  step,
  value,
  defaultValue,
  ...props
}: StepperNumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const stepSize = parseNumericStep(step);
  const minValue = parseBound(min);
  const maxValue = parseBound(max);

  function emit(next: string) {
    const input = inputRef.current;
    if (input && value === undefined) {
      input.value = next;
    }
    const event = {
      target: { value: next, name: props.name ?? "", id: props.id ?? "" },
      currentTarget: input ?? ({ value: next } as HTMLInputElement),
    } as ChangeEvent<HTMLInputElement>;
    onChange?.(event);
  }

  function bump(direction: 1 | -1) {
    const current =
      value !== undefined
        ? String(value)
        : String(inputRef.current?.value ?? defaultValue ?? "");
    emit(nudgeNumericValue(current, direction, stepSize, minValue, maxValue));
  }

  return (
    <div className={`flex items-stretch gap-1.5 ${className ?? ""}`}>
      <div className="relative min-w-0 flex-1">
        <input
          {...props}
          ref={inputRef}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          onWheel={(event) => {
            blockNumberWheel(event);
            onWheel?.(event);
          }}
          className={`${inputClassName ?? defaultInputClass} input-no-spinner ${suffix ? "pr-16" : ""}`}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-medium text-slate-400"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      <div className="flex w-11 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Augmenter"
          disabled={props.disabled}
          onClick={() => bump(1)}
          className="inline-flex min-h-[22px] flex-1 items-center justify-center text-slate-600 hover:bg-white disabled:opacity-50"
        >
          <ChevronUp className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Diminuer"
          disabled={props.disabled}
          onClick={() => bump(-1)}
          className="inline-flex min-h-[22px] flex-1 items-center justify-center border-t border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

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
        className={`${defaultInputClass}${type === "number" ? " input-no-spinner" : ""}`}
        {...props}
        onWheel={type === "number" ? (event) => {
          blockNumberWheel(event);
          props.onWheel?.(event);
        } : props.onWheel}
        onInvalid={(event) => {
          scrollInvalidFieldIntoView(event.currentTarget);
          props.onInvalid?.(event);
        }}
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
        className={`${defaultInputClass} appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...props}
        onInvalid={(event) => {
          scrollInvalidFieldIntoView(event.currentTarget);
          props.onInvalid?.(event);
        }}
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
      <StepperNumberInput
        id={id}
        inputMode="numeric"
        min={0}
        suffix="F CFA"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
        onInvalid={(event) => {
          scrollInvalidFieldIntoView(event.currentTarget);
          props.onInvalid?.(event);
        }}
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

type NumberFieldProps = Omit<TextFieldProps, "type">;

export function NumberField({ id, label, hint, error, className, ...props }: NumberFieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <StepperNumberInput
        id={id}
        inputMode="numeric"
        min={0}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
        onInvalid={(event) => {
          scrollInvalidFieldIntoView(event.currentTarget);
          props.onInvalid?.(event);
        }}
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
