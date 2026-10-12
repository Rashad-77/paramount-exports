import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Form controls. Each control is wrapped in <Field>, which wires label, hint and error text to the input
 * (htmlFor / aria-describedby / aria-invalid) so errors are announced and never rely on colour alone.
 */

const control =
  "block w-full min-h-10 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 py-2 text-base " +
  "text-text placeholder:text-text-muted/70 transition-colors duration-[var(--duration-fast)] " +
  "hover:border-walnut disabled:bg-linen disabled:cursor-not-allowed aria-[invalid=true]:border-danger aria-[invalid=true]:border-2";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Set false for search/filter controls, where "(optional)" is just noise. */
  showOptional?: boolean;
  className?: string;
}

function useFieldIds(explicit?: string) {
  const generated = useId();
  const id = explicit ?? generated;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

function Shell({
  id,
  hintId,
  errorId,
  label,
  hint,
  error,
  required,
  showOptional = true,
  className,
  children,
}: FieldShellProps & { id: string; hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        ) : showOptional ? (
          <span className="font-normal text-text-muted"> (optional)</span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(hint: string | undefined, error: string | undefined, ids: { hintId: string; errorId: string }) {
  return error ? ids.errorId : hint ? ids.hintId : undefined;
}

export interface TextFieldProps extends FieldShellProps, Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  inputClassName?: string;
}

export function TextField({ label, hint, error, required, showOptional, className, inputClassName, id: idProp, ...props }: TextFieldProps) {
  const ids = useFieldIds(idProp);
  return (
    <Shell {...ids} {...{ label, hint, error, required, showOptional, className }}>
      <input
        id={ids.id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        className={cn(control, inputClassName)}
        {...props}
      />
    </Shell>
  );
}

export interface TextAreaFieldProps extends FieldShellProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {}

export function TextAreaField({ label, hint, error, required, showOptional, className, id: idProp, rows = 4, ...props }: TextAreaFieldProps) {
  const ids = useFieldIds(idProp);
  return (
    <Shell {...ids} {...{ label, hint, error, required, showOptional, className }}>
      <textarea
        id={ids.id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        className={cn(control, "resize-y")}
        {...props}
      />
    </Shell>
  );
}

export interface SelectFieldProps extends FieldShellProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}

export function SelectField({ label, hint, error, required, showOptional, className, id: idProp, options, placeholder, ...props }: SelectFieldProps) {
  const ids = useFieldIds(idProp);
  return (
    <Shell {...ids} {...{ label, hint, error, required, showOptional, className }}>
      <select
        id={ids.id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        className={cn(control, "pr-8")}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}
