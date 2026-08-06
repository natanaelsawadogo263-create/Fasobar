"use client";

import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";

import {
  passwordStrengthLabel,
  scorePasswordStrength,
} from "@/lib/users/password-policy";

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  value?: string;
  onChange?: (value: string) => void;
  showStrength?: boolean;
  compact?: boolean;
};

export function PasswordField({
  id,
  name,
  label,
  autoComplete = "new-password",
  required = false,
  hint,
  value,
  onChange,
  showStrength = false,
  compact = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = useMemo(
    () => (showStrength && value ? scorePasswordStrength(value) : 0),
    [showStrength, value],
  );

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <label
        htmlFor={id}
        className={`block font-medium text-slate-700 ${compact ? "text-[12px]" : "text-sm"}`}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className={`w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm outline-none ring-emerald-600 focus:ring-2 [appearance:textfield] ${
            compact ? "h-10" : "h-11 px-4 pr-11"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-400 transition hover:text-slate-600"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint ? (
        <p className={`text-slate-500 ${compact ? "text-[11px] leading-snug" : "mt-1 text-xs"}`}>
          {hint}
        </p>
      ) : null}
      {showStrength && value ? (
        <div className={compact ? "space-y-0.5" : "mt-2 space-y-1"}>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={index}
                className={`flex-1 rounded-full ${compact ? "h-1" : "h-1.5"} ${
                  index < strength ? "bg-emerald-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <p className={compact ? "text-[11px] text-slate-500" : "text-xs text-slate-500"}>
            Qualité : {passwordStrengthLabel(strength)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
