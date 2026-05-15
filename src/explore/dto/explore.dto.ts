import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class ExploreDto {

  @IsString()
  @IsNotEmpty()
  json: string;

  @IsString()
  @IsNotEmpty()
  query: string;
}
