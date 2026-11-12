import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateOfferDto {
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  quantity!: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  pricePerUnit!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
