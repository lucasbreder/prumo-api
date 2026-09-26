import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { ListMediaUseCase } from '../application/media.usecases.js';
import { ListMediaQuery } from './dtos.js';

@Controller('admin/media')
@Roles('ADMIN')
export class MediaController {
  constructor(private readonly listMedia: ListMediaUseCase) {}

  @Get()
  async list(@Query() query: ListMediaQuery) {
    return this.listMedia.execute({
      search: query.search,
      tipo: query.tipo,
    });
  }
}

// Versão leve para seletores (mentor/admin): só o necessário para escolher um
// arquivo, sem os "usadoEm" (evita expor títulos de outros cursos aos mentores).
@Controller('media')
@Roles('ADMIN', 'MENTOR')
export class MediaSelectorController {
  constructor(private readonly listMedia: ListMediaUseCase) {}

  @Get('selector')
  async selector(@Query() query: ListMediaQuery) {
    const { media } = await this.listMedia.execute({
      search: query.search,
      tipo: query.tipo,
    });
    return {
      media: media.map((m) => ({
        id: m.id,
        chave: m.chave,
        nome: m.nome,
        tipo: m.tipo,
        extensao: m.extensao,
        sizeBytes: m.sizeBytes,
        url: m.url,
      })),
    };
  }
}
