/** Shape returned by every Server Action used with <ActionForm>. Safe to import from client components. */
export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Raw submitted string values (never passwords/tokens) so a failed submit does not wipe the form. */
  values?: Record<string, string>;
  /** Data an action hands back to its form on success (never secrets). */
  data?: unknown;
}
