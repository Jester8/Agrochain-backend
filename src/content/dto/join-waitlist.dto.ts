import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from '../../auth/dto/normalize-email';

export class JoinWaitlistDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;
}
