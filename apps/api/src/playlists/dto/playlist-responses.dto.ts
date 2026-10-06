import { ApiProperty } from '@nestjs/swagger';
import type {
  EditDenyReason,
  EditPermission,
  MemberRole,
  PlaylistLicense,
  PlaylistView,
  PlaylistVisibility,
} from '@music-room/shared';
import { UserRefDto } from '../../users/dto/user-responses.dto';

// See auth-responses.dto.ts: `implements` keeps the docs in step with the contract.

export class EditPermissionDto {
  /** Whether you can add, remove and reorder tracks. */
  allowed: boolean;

  /** Present when `allowed` is false. */
  @ApiProperty({ enum: ['not_member', 'not_invited'], required: false })
  reason?: EditDenyReason;
}

export class PlaylistViewDto implements PlaylistView {
  id: string;

  /** @example "Road trip" */
  name: string;

  description: string;

  @ApiProperty({ enum: ['public', 'private'] })
  visibility: PlaylistVisibility;

  /** open = anyone who can see it edits · invited = owner + invited accounts only */
  @ApiProperty({ enum: ['open', 'invited'] })
  license: PlaylistLicense;

  @ApiProperty({ type: UserRefDto })
  owner: { id: string; displayName: string };

  /** Your membership; null = not a member (only possible for public playlists). */
  @ApiProperty({ enum: ['owner', 'invited', 'guest'], nullable: true })
  myRole: MemberRole | null;

  /** 8 characters; only shown to members. */
  @ApiProperty({ type: String, nullable: true })
  inviteCode: string | null;

  @ApiProperty({ type: EditPermissionDto })
  canEdit: EditPermission;

  trackCount: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
