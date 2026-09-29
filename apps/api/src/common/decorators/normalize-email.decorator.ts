import { Transform } from 'class-transformer';

// Must match the DB's CHK_users_email_normalized constraint on users.email.
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
