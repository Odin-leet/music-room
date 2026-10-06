import { ApiProperty } from '@nestjs/swagger';
import type { AuthTokens } from '@music-room/shared';

// Response shapes for the API docs. Each `implements` the shared contract
// type, so if the contract changes and this class doesn't, the API stops
// compiling — the docs can't silently drift from what the API returns.

export class TokenPairDto implements AuthTokens {
  /** Short-lived JWT (15 min). Send as `Authorization: Bearer <accessToken>`. */
  accessToken: string;

  /** Opaque, single-use refresh token (7 days). Rotated on every POST /auth/refresh. */
  @ApiProperty({ example: 'Qx3…' })
  refreshToken: string;
}
