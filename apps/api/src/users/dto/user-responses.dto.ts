import type { CurrentUser } from '@music-room/shared';

// See auth-responses.dto.ts: `implements` keeps the docs in step with the contract.

export class CurrentUserDto implements CurrentUser {
  /** @example "baaa7e88-cac5-41d3-b29d-4b3e64941eec" */
  id: string;

  /** Always lower-case. @example "alice@example.com" */
  email: string;

  /** @example "Alice" */
  displayName: string;

  /** False until the user enters the 6-digit code emailed at registration. */
  emailVerified: boolean;
}

export class UserRefDto {
  id: string;

  displayName: string;
}
