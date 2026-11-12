import { IsEmail, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from './normalize-email';

export class ResendOtpDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsIn(['signup', 'password-reset'])
  purpose!: 'signup' | 'password-reset';
}
