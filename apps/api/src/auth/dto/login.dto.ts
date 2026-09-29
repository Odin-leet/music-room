import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  // No length rules here: login only checks the password, it doesn't set one.
  @IsString()
  @IsNotEmpty()
  password: string;
}
