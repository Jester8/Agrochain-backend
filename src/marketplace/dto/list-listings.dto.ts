import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const CATEGORIES = ['grains', 'tubers', 'vegetables', 'fruits', 'cash-crops', 'spices', 'oils'] as const;

export class ListListingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  state?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  verified?: 'true' | 'false';

  @IsOptional()
  @IsIn(['newest', 'price-asc', 'price-desc'])
  sort?: 'newest' | 'price-asc' | 'price-desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;
}
