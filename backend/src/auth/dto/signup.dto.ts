import { IsDateString, IsEmail, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from './normalize-email';

export class SignupDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'Password must be at least 8 characters and include a letter and a number.',
  })
  password!: string;

  @IsString()
  farmName!: string;

  @IsNumber()
  @Min(0)
  farmSizeHectares!: number;

  @IsString()
  primaryCrop!: string;

  @IsString()
  state!: string;

  @IsString()
  lga!: string;
}
