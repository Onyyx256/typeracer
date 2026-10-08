"use client";

import { useId } from "react";

type TextFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
  autoComplete: string;
  maxLength?: number;
  /** Shown beside the label; replaced by `error` when there is one. */
  hint?: string;
  error?: string;
  action?: React.ReactNode;
};

export function TextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  autoComplete,
  maxLength,
  hint,
  error,
  action,
}: TextFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {message && (
          <p
            id={messageId}
            className={`text-right text-xs ${error ? "text-danger" : "text-muted"}`}
          >
            {message}
          </p>
        )}
      </div>
      <div
        className={`mt-1.5 flex h-11 items-center border bg-surface transition-colors focus-within:border-primary-text rounded-leaf ${
          error ? "border-danger" : "border-line"
        }`}
      >
        <span
          className="pl-4 font-mono text-accent-text select-none"
          aria-hidden="true"
        >
          &gt;
        </span>
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-base outline-hidden"
        />
        {action}
      </div>
    </div>
  );
}
