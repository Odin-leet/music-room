import { MUSIC_GENRES, type MusicGenre, type ProfileVisibility } from '@music-room/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MAX_ARTISTS, PROFILE_VISIBILITIES } from '../user.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Optional text that can be cleared: "" or null both mean "remove it".
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const present = (_o: unknown, v: unknown) => v !== undefined;
const presentNotNull = (_o: unknown, v: unknown) => v !== undefined && v !== null;

// PATCH /users/me/profile. Every field is optional: send only what changes.
export class UpdateProfileDto {
  // ---- public ----
  /** @example "Alice" */
  @Transform(trim)
  @ValidateIf(present)
  @IsString()
  @Length(1, 100)
  displayName?: string;

  /** Visible to everyone. @example "Jazz on Sundays, techno on Fridays" */
  @Transform(trim)
  @ValidateIf(present)
  @MaxLength(300)
  @IsString() // listed last so its message comes first for a non-string
  bio?: string;

  // ---- friends only (null or "" clears) ----
  /** @example "Alice Martin" */
  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 100 })
  @Transform(trimOrNull)
  @ValidateIf(presentNotNull)
  @IsString()
  @MaxLength(100)
  realName?: string | null;

  /** @example "Lyon" */
  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 100 })
  @Transform(trimOrNull)
  @ValidateIf(presentNotNull)
  @IsString()
  @MaxLength(100)
  city?: string | null;

  // ---- private (null or "" clears) ----
  /** @example "+33 6 12 34 56 78" */
  @ApiProperty({ type: String, nullable: true, required: false })
  @Transform(trimOrNull)
  @ValidateIf(presentNotNull)
  @Matches(/^\+?[0-9 ().-]{5,30}$/, { message: 'phone must be a phone number' })
  phone?: string | null;

  /** YYYY-MM-DD. @example "1999-04-01" */
  @ApiProperty({ type: String, format: 'date', nullable: true, required: false })
  @Transform(trimOrNull)
  @ValidateIf(presentNotNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must be YYYY-MM-DD' })
  birthDate?: string | null;

  // ---- music ----
  /** From the fixed genre list. @example ["jazz","soul"] */
  @ApiProperty({ enum: MUSIC_GENRES, isArray: true, required: false })
  @ValidateIf(present)
  @IsArray()
  @ArrayUnique()
  @IsIn(MUSIC_GENRES, { each: true, message: 'musicGenres must only contain known genres' })
  musicGenres?: MusicGenre[];

  /** Up to 10 artist names. @example ["Nina Simone","Daft Punk"] */
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value,
  )
  @ValidateIf(present)
  @IsArray()
  @ArrayMaxSize(MAX_ARTISTS)
  @ArrayUnique((a: string) => a.toLowerCase(), { message: 'musicArtists must not repeat an artist' })
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  musicArtists?: string[];

  /** Who may see your music preferences. */
  @ApiProperty({ enum: PROFILE_VISIBILITIES, required: false })
  @ValidateIf(present)
  @IsIn(PROFILE_VISIBILITIES)
  musicVisibility?: ProfileVisibility;
}

export class SearchUsersDto {
  /** At least 2 characters of a display name. @example "ali" */
  @Transform(trim)
  @IsString()
  @Length(2, 50)
  q: string;
}
