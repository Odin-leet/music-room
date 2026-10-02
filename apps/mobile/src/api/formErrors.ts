import { ApiError } from './client';

export type FormErrors = {
  // Message per input, shown under that field.
  fields: Record<string, string>;
  // Message for the whole form, shown above the submit button.
  form: string | null;
};

export const noErrors: FormErrors = { fields: {}, form: null };

// Decides where an API error is shown on a form.
export function toFormErrors(err: unknown): FormErrors {
  if (!(err instanceof ApiError)) return { fields: {}, form: 'Something went wrong' };

  // ValidationPipe 400: one message per field.
  if (Object.keys(err.fieldErrors).length > 0) return { fields: err.fieldErrors, form: null };

  // The only 409 our auth API returns is a taken email.
  if (err.status === 409) return { fields: { email: err.message }, form: null };

  // 401 "Invalid email or password", network errors (status 0), 5xx…
  return { fields: {}, form: err.message };
}
