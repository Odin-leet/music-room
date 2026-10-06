import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { EVENT_LICENSES, EVENT_VISIBILITIES, type EventLicense, type EventVisibility } from '../event.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// The geo fields: required when license = 'geo' (the service also rejects
// them for other licenses — the DB CHECK would too).
class GeoFields {
  @ValidateIf((o: GeoFields & { license?: EventLicense }) => o.license === 'geo')
  @IsLatitude()
  geoLat?: number;

  @ValidateIf((o: GeoFields & { license?: EventLicense }) => o.license === 'geo')
  @IsLongitude()
  geoLng?: number;

  // 10 m (a room) to 50 km (a city).
  @ValidateIf((o: GeoFields & { license?: EventLicense }) => o.license === 'geo')
  @IsInt()
  @Min(10)
  @Max(50_000)
  geoRadiusM?: number;

  @ValidateIf((o: GeoFields & { license?: EventLicense }) => o.license === 'geo')
  @IsDateString({ strict: true })
  startsAt?: string;

  @ValidateIf((o: GeoFields & { license?: EventLicense }) => o.license === 'geo')
  @IsDateString({ strict: true })
  endsAt?: string;
}

export class CreateEventDto extends GeoFields {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(EVENT_VISIBILITIES)
  visibility: EventVisibility;

  @IsOptional()
  @IsIn(EVENT_LICENSES)
  license?: EventLicense;
}

// Every field optional; the service merges it with the current event and
// re-checks the whole result (e.g. switching to 'geo' needs the geo fields).
export class UpdateEventDto extends GeoFields {
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
  @IsIn(EVENT_VISIBILITIES)
  visibility?: EventVisibility;

  @IsOptional()
  @IsIn(EVENT_LICENSES)
  license?: EventLicense;
}
