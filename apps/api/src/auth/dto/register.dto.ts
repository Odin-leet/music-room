import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

export class RegisterDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  // bcrypt only uses the first 72 bytes of the input.
  @MaxLength(72)
  password: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;
}
