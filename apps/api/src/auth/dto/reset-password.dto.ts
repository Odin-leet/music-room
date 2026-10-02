import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

export class ResetPasswordDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  // Same rules as registration.
  @IsString()
  @MinLength(8)
  // bcrypt only uses the first 72 bytes of the input.
  @MaxLength(72)
  newPassword: string;
}
