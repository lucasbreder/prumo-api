import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { ActiveSubscriptionGuard } from '../../../shared/auth/active-subscription.guard.js';
import { UseGuards } from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ListAgendaLivesUseCase,
  RemoveLiveUseCase,
  SaveLiveUseCase,
  TransitionLiveUseCase,
  toAdminView,
} from '../application/use-cases/lives.usecases.js';
import { LIVE_READER } from '../domain/repositories.js';
import type { LiveReader } from '../domain/repositories.js';
class SaveLiveInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
  @IsIn(['LIVE', 'MENTORING'])
  type!: 'LIVE' | 'MENTORING';
  @IsString()
  @IsNotEmpty()
  startsAt!: string;
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(600)
  durationMin = 60;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  roomUrl?: string;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  recordingUrl?: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mentorName?: string;
}
class EndLiveInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  recordingUrl?: string;
}
@Controller('lives')
@Roles('STUDENT', 'MENTOR', 'ADMIN')
@UseGuards(ActiveSubscriptionGuard)
export class LivesController {
  constructor(private readonly agenda: ListAgendaLivesUseCase) {}
  @Get()
  async list() {
    return this.agenda.execute();
  }
}
@Controller('admin/lives')
@Roles('ADMIN')
export class AdminLivesController {
  constructor(
    @Inject(LIVE_READER)
    private readonly reader: LiveReader,
    private readonly save: SaveLiveUseCase,
    private readonly transicionar: TransitionLiveUseCase,
    private readonly remove: RemoveLiveUseCase,
  ) {}
  @Get()
  async list() {
    const lives = await this.reader.list();
    return { lives: lives.map(toAdminView) };
  }
  @Post()
  async create(
    @Body()
    input: SaveLiveInputDto,
  ) {
    const live = await this.save.execute(input);
    return { live: toAdminView(live) };
  }
  @Patch(':id')
  async update(
    @Param('id')
    id: string,
    @Body()
    input: SaveLiveInputDto,
  ) {
    const live = await this.save.execute({ ...input, id });
    return { live: toAdminView(live) };
  }
  @Post(':id/start')
  @HttpCode(200)
  async start(
    @Param('id')
    id: string,
  ) {
    return { live: toAdminView(await this.transicionar.start(id)) };
  }
  @Post(':id/end')
  @HttpCode(200)
  async end(
    @Param('id')
    id: string,
    @Body()
    input: EndLiveInputDto,
  ) {
    return {
      live: toAdminView(
        await this.transicionar.end(id, input.recordingUrl ?? null),
      ),
    };
  }
  @Delete(':id')
  @HttpCode(204)
  async removeLive(
    @Param('id')
    id: string,
  ): Promise<void> {
    await this.remove.execute(id);
  }
}
