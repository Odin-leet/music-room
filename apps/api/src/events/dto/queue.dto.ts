import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsUUID, Matches, ValidateIf } from 'class-validator';

// Sent with suggestions and votes. Only used by license 'geo' events, and
// treated as untrusted (GPS can be faked): checked and logged, not proof.
export class LocationDto {
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;
}

export class SuggestTrackDto extends LocationDto {
  // Deezer track id (digits). The server fetches the details itself.
  @Matches(/^\d{1,20}$/, { message: 'providerTrackId must be a Deezer track id' })
  providerTrackId: string;
}

export class NextTrackDto {
  // The track the owner's phone believes is playing (null = nothing yet).
  // Omit it to advance unconditionally.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  currentTrackId?: string | null;
}
