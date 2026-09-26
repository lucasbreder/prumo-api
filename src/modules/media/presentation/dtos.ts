import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TIPOS_MIDIA, type TipoMidia } from '../domain/media.vo.js';

export class ListMediaQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
  @IsOptional()
  @IsIn(TIPOS_MIDIA)
  tipo?: TipoMidia;
}
