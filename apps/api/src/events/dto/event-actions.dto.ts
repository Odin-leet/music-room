import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

export class JoinByCodeDto {
  // Codes are shown upper-case; accept them typed in any case, with spaces.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value,
  )
  @IsString()
  @Length(8, 8)
  inviteCode: string;
}

export class InviteDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
