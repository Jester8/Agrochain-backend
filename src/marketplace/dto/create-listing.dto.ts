import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CATEGORIES } from './list-listings.dto';

export class CreateListingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  localName?: string;

  @IsIn(CATEGORIES)
  category!: string;

  @IsString()
  state!: string;

  @IsString()
  lga!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  price!: number;

  @IsString()
  @MaxLength(40)
  unit!: string;

  @IsInt()
  @Min(1)
  minOrder!: number;

  @IsInt()
  @Min(0)
  available!: number;

  @IsIn(['A', 'B'])
  grade!: 'A' | 'B';

  @IsDateString()
  harvestedOn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
