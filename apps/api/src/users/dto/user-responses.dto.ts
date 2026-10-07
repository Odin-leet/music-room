import {
  MUSIC_GENRES,
  type CurrentUser,
  type FriendshipState,
  type MusicGenre,
  type ProfileRelation,
  type ProfileVisibility,
  type UserProfile,
  type UserSummary,
} from '@music-room/shared';
import { ApiProperty } from '@nestjs/swagger';

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

// ---------- Profile (V.1) ----------

class PublicTierDto {
  displayName: string;
  bio: string;
}

class FriendsTierDto {
  @ApiProperty({ type: String, nullable: true })
  realName: string | null;

  @ApiProperty({ type: String, nullable: true })
  city: string | null;
}

class PrivateTierDto {
  @ApiProperty({ type: String, nullable: true })
  phone: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  birthDate: string | null;
}

class MusicTierDto {
  @ApiProperty({ enum: MUSIC_GENRES, isArray: true })
  genres: MusicGenre[];

  artists: string[];
}

export class UserProfileDto implements UserProfile {
  id: string;

  /** How you relate to this person; decides which tiers are filled in. */
  @ApiProperty({ enum: ['self', 'friend', 'other', 'anonymous'] })
  relation: ProfileRelation;

  /** null when not logged in, and on your own profile. */
  @ApiProperty({ enum: ['none', 'friends', 'request_sent', 'request_received'], nullable: true })
  friendship: FriendshipState | null;

  public: PublicTierDto;

  /** Friends and yourself only; otherwise null. */
  @ApiProperty({ type: FriendsTierDto, nullable: true })
  friendsOnly: FriendsTierDto | null;

  /** Yourself only; otherwise null. */
  @ApiProperty({ type: PrivateTierDto, nullable: true })
  private: PrivateTierDto | null;

  /** Visible according to the owner's musicVisibility; otherwise null. */
  @ApiProperty({ type: MusicTierDto, nullable: true })
  music: MusicTierDto | null;

  /** Your own choice; only on your own profile. */
  @ApiProperty({ enum: ['public', 'friends', 'private'], nullable: true })
  musicVisibility: ProfileVisibility | null;
}

export class UserSummaryDto implements UserSummary {
  id: string;

  displayName: string;

  bio: string;
}
