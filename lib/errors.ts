/**
 * Extract a human-readable message from Supabase/PostgREST errors and other thrown values.
 */
export function getErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';

  if (typeof err === 'string') return err;

  if (err instanceof Error) return err.message;

  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
    if (typeof obj.details === 'string' && obj.details) return obj.details;
    if (typeof obj.hint === 'string' && obj.hint) return obj.hint;
  }

  return 'Unknown error';
}