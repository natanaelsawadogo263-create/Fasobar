"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

type FormSelectProps = {
  id: string;
  label: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function FormField({
  id,
  label,
  hint,
  children,
  className,
  type,
  ...props
}: FormFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const inputClassName = `w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${
    isPassword ? "pr-11" : ""
  } ${className ?? ""}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children ?? (
        <div className="relative">
          <input
            id={id}
            type={isPassword ? (revealed ? "text" : "password") : type}
            className={inputClassName}
            {...props}
            onInvalid={(event) => {
              event.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
              props.onInvalid?.(event);
            }}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
              aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={revealed}
            >
              {revealed ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </button>
          ) : null}
        </div>
      )}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function FormSelect({
  id,
  label,
  children,
  className,
  ...props
}: FormSelectProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
