import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import {
  PLAYLIST_LICENSES,
  PLAYLIST_VISIBILITIES,
  type PlaylistLicense,
  type PlaylistVisibility,
} from '../playlist.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePlaylistDto {
  /** @example "Road trip" */
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(PLAYLIST_VISIBILITIES)
  visibility: PlaylistVisibility;

  /** Who may edit. Default: open. */
  @IsOptional()
  @IsIn(PLAYLIST_LICENSES)
  license?: PlaylistLicense;
}

export class UpdatePlaylistDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(PLAYLIST_VISIBILITIES)
  visibility?: PlaylistVisibility;

  @IsOptional()
  @IsIn(PLAYLIST_LICENSES)
  license?: PlaylistLicense;
}
