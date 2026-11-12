import { IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsString, Matches, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from './normalize-email';

export const USER_ROLES = ['farmer', 'cooperative', 'buyer', 'aggregator'] as const;
export type UserRoleValue = (typeof USER_ROLES)[number];

// Farmers and cooperatives register a farm; buyers and aggregators don't.
// `role` is optional and defaults to "farmer", so existing clients (the Expo
// app) keep working unchanged.
const hasFarm = (dto: SignupDto) => !dto.role || dto.role === 'farmer' || dto.role === 'cooperative';

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

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRoleValue;

  @ValidateIf(hasFarm)
  @IsString()
  farmName?: string;

  @ValidateIf(hasFarm)
  @IsNumber()
  @Min(0)
  farmSizeHectares?: number;

  @ValidateIf(hasFarm)
  @IsString()
  primaryCrop?: string;

  @IsString()
  state!: string;

  @ValidateIf(hasFarm)
  @IsString()
  lga?: string;
}
