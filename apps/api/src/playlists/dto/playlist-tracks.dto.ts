import { ApiProperty } from '@nestjs/swagger';
import type { PlaylistTrackView, PlaylistTracksView } from '@music-room/shared';
import { IsOptional, IsUUID, Matches, ValidateIf } from 'class-validator';
import { TrackSummaryDto } from '../../music/dto/music-responses.dto';
import { UserRefDto } from '../../users/dto/user-responses.dto';

// ---------- requests ----------

export class AddPlaylistTrackDto {
  /** Deezer track id. The server fetches the details itself. @example "3135553" */
  @Matches(/^\d{1,20}$/, { message: 'providerTrackId must be a Deezer track id' })
  providerTrackId: string;

  /** Put it right after this playlist entry. Omit = at the end; null = at the top. */
  @ApiProperty({ type: String, format: 'uuid', nullable: true, required: false })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  afterId?: string | null;
}

export class MovePlaylistTrackDto {
  /** Put the track right after this playlist entry; null = at the top. */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  afterId: string | null;
}

// ---------- responses (implements = can't drift from the contract) ----------

export class PlaylistTrackDto extends TrackSummaryDto implements PlaylistTrackView {
  /** The playlist entry's id: use it to move or remove. */
  id: string;

  /** Fractional position key. Sort with plain code-unit comparison (not localeCompare). @example "a0V" */
  position: string;

  @ApiProperty({ type: UserRefDto, nullable: true })
  addedBy: { id: string; displayName: string } | null;

  @ApiProperty({ format: 'date-time' })
  addedAt: string;
}

export class PlaylistTracksDto implements PlaylistTracksView {
  playlistId: string;

  /** Already in order. */
  @ApiProperty({ type: [PlaylistTrackDto] })
  tracks: PlaylistTrackView[];
}
