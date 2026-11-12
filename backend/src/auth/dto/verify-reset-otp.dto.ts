import { IsEmail, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from './normalize-email';

export class VerifyResetOtpDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @Length(4, 4)
  code!: string;
}
