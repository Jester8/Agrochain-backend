import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from './normalize-email';

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;
}
