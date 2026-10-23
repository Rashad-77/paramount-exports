import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { GlassSelect } from "@/components/public/glass-select";
import { cn } from "@/lib/cn";

/**
 * Form controls. Each control is wrapped in <Field>, which wires label, hint and error text to the input
 * (htmlFor / aria-describedby / aria-invalid) so errors are announced and never rely on colour alone.
 */

const control =
  "block w-full min-h-11 border border-border-strong bg-surface px-3 py-2 fl-input md:min-h-10 pointer-coarse:min-h-11 " +
  "text-text placeholder:text-text-muted/70 transition-[border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] " +
  "focus:shadow-none focus-visible:outline-none " +
  "disabled:bg-linen disabled:cursor-not-allowed aria-[invalid=true]:border-danger aria-[invalid=true]:border-2";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Kept so existing calls still compile; fields no longer say "(optional)". A required field is marked with an asterisk. */
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
  className,
  children,
}: FieldShellProps & { id: string; hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium tracking-[0.01em] text-text">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
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

export interface SelectFieldProps extends FieldShellProps {
  name?: string;
  id?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

/** A drop-down in the site's glass style. It posts its value with the form under `name`, like a native select. */
export function SelectField({ label, hint, error, required, showOptional, className, id: idProp, options, placeholder, name, value, defaultValue, disabled, onValueChange }: SelectFieldProps) {
  const ids = useFieldIds(idProp);
  const all = placeholder ? [{ value: "", label: placeholder }, ...options] : [...options];
  return (
    <Shell {...ids} {...{ label, hint, error, required, showOptional, className }}>
      <GlassSelect
        variant="field"
        id={ids.id}
        label={label}
        name={name}
        options={all}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        invalid={Boolean(error)}
        describedBy={describedBy(hint, error, ids)}
        onChange={onValueChange}
      />
    </Shell>
  );
}
