import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class ExploreDto {
  @IsOptional()
  @IsString()
  curl?: string;

  @IsOptional()
  @IsString()
  json?: string;

  @IsString()
  @IsNotEmpty()
  query: string;
}
