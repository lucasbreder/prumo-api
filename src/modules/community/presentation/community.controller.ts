import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../shared/auth/auth-user.types.js';
import { ActiveSubscriptionGuard } from '../../../shared/auth/active-subscription.guard.js';
import {
  CreateThreadUseCase,
  ReportThreadUseCase,
  ListThreadsUseCase,
  ModerateThreadUseCase,
  GetReportsKpisUseCase,
  GetRulesUseCase,
  ReactThreadUseCase,
  ResolveReportUseCase,
  ResponderThreadUseCase,
  SaveRulesUseCase,
} from '../application/use-cases/community.usecases.js';
import { PagedQueryInput } from '../../../shared/pagination/pagination.js';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
class ListThreadsQuery extends PagedQueryInput {
  @IsOptional()
  @IsIn(['PUBLISHED', 'PENDING', 'HIDDEN'])
  status?: 'PUBLISHED' | 'PENDING' | 'HIDDEN';
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}
class CreateThreadInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  category!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}
class ReplyInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}
class ReportInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
class ModerateInput {
  @IsIn(['APPROVE', 'PUBLISH', 'HIDE', 'PIN'])
  action!: 'APPROVE' | 'PUBLISH' | 'HIDE' | 'PIN';
}
class ResolveReportInput {
  @IsIn(['REMOVE', 'IGNORE', 'BAN_AUTHOR'])
  decision!: 'REMOVE' | 'IGNORE' | 'BAN_AUTHOR';
}
class SaveRulesInput {
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  text!: string[];
}
@Controller('community')
@Roles('STUDENT', 'MENTOR', 'ADMIN')
@UseGuards(ActiveSubscriptionGuard)
export class CommunityController {
  constructor(
    private readonly listThreads: ListThreadsUseCase,
    private readonly createThread: CreateThreadUseCase,
    private readonly react: ReactThreadUseCase,
    private readonly replyThread: ResponderThreadUseCase,
    private readonly reportThread: ReportThreadUseCase,
    private readonly getRules: GetRulesUseCase,
  ) {}
  @Get()
  async list(
    @CurrentUser()
    user: AuthUser,
    @Query()
    query: ListThreadsQuery,
  ) {
    return this.listThreads.execute({
      ...query,
      userId: user.id,
      status: query.status ?? 'PUBLISHED',
      replyStatuses: ['PUBLISHED'],
    });
  }
  @Get('rules')
  async rulesList() {
    return this.getRules.execute();
  }
  @Post()
  async create(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: CreateThreadInput,
  ) {
    return this.createThread.execute({
      authorId: user.id,
      authorRole: user.role,
      ...input,
    });
  }
  @Post(':id/react')
  @HttpCode(200)
  async like(
    @CurrentUser()
    user: AuthUser,
    @Param('id')
    id: string,
  ) {
    return this.react.execute({ userId: user.id, threadId: id });
  }
  @Post(':id/replies')
  async reply(
    @CurrentUser()
    user: AuthUser,
    @Param('id')
    id: string,
    @Body()
    input: ReplyInput,
  ) {
    return this.replyThread.execute({
      authorId: user.id,
      authorRole: user.role,
      threadId: id,
      content: input.content,
    });
  }
  @Post(':id/report')
  async report(
    @CurrentUser()
    user: AuthUser,
    @Param('id')
    id: string,
    @Body()
    input: ReportInput,
  ) {
    return this.reportThread.execute({
      userId: user.id,
      threadId: id,
      reason: input.reason,
    });
  }
}
@Controller('admin')
@Roles('ADMIN')
export class AdminCommunityController {
  constructor(
    private readonly listThreads: ListThreadsUseCase,
    private readonly moderate: ModerateThreadUseCase,
    private readonly listReportsUseCase: ListReportsUseCase,
    private readonly resolveReport: ResolveReportUseCase,
    private readonly reportsKpisUseCase: GetReportsKpisUseCase,
    private readonly getRules: GetRulesUseCase,
    private readonly saveRules: SaveRulesUseCase,
  ) {}
  @Get('community')
  async queue(
    @Query()
    query: ListThreadsQuery,
  ) {
    return this.listThreads.execute({
      ...query,
      replyStatuses: ['PUBLISHED', 'PENDING', 'HIDDEN'],
    });
  }
  @Get('community/rules')
  async rulesGet() {
    return this.getRules.execute();
  }
  @Patch('community/rules')
  @HttpCode(200)
  async rulesSet(
    @Body()
    input: SaveRulesInput,
  ) {
    return this.saveRules.execute(input);
  }
  @Patch('community/:id')
  @HttpCode(200)
  async applyAction(
    @Param('id')
    id: string,
    @Body()
    input: ModerateInput,
  ) {
    return this.moderate.execute({ threadId: id, action: input.action });
  }
  @Get('community/kpis')
  async reportsKpis() {
    return this.reportsKpisUseCase.execute();
  }
  @Get('reports')
  async listReports(
    @Query('status')
    status?: 'IN_ANALYSIS' | 'RESOLVED',
    @Query('page')
    page = 1,
    @Query('perPage')
    perPage = 12,
  ) {
    return this.listReportsUseCase.execute({
      status,
      page: Number(page),
      perPage: Number(perPage),
    });
  }
  @Post('reports/:id/resolve')
  @HttpCode(200)
  async resolve(
    @Param('id')
    id: string,
    @Body()
    input: ResolveReportInput,
  ) {
    return this.resolveReport.execute({
      reportId: id,
      decision: input.decision,
    });
  }
}
import { ListReportsUseCase } from '../application/use-cases/list-reports.usecase.js';
