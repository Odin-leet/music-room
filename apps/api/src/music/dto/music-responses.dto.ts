import { ApiProperty } from '@nestjs/swagger';
import type { TrackPreview, TrackSummary } from '@music-room/shared';

export class TrackSummaryDto implements TrackSummary {
  @ApiProperty({ enum: ['deezer'] })
  provider: 'deezer';

  /** The provider's track id (Deezer: digits). @example "3135553" */
  providerTrackId: string;

  /** @example "One More Time" */
  title: string;

  /** @example "Daft Punk" */
  artist: string;

  /** @example "Discovery" */
  album: string;

  @ApiProperty({ type: String, nullable: true })
  coverUrl: string | null;

  /** @example 320 */
  durationSec: number;

  /** International Standard Recording Code (same recording across providers). */
  @ApiProperty({ type: String, nullable: true, example: 'GBDUW0000053' })
  isrc: string | null;
}

export class TrackPreviewDto implements TrackPreview {
  /** Signed MP3 link (30 s). Never store it: it expires. */
  url: string;

  /** When the link stops working (≈ 15 minutes). */
  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}
