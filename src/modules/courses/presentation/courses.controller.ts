import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../../../shared/auth/decorators/public.decorator.js';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../shared/auth/auth-user.types.js';
import {
  ListPublicCoursesUseCase,
  ListTracksUseCase,
  GetCoursePublicUseCase,
} from '../application/use-cases/public.usecases.js';
import {
  CompleteLessonUseCase,
  ListConcluidosUseCase,
  ListDownloadsUseCase,
  ListMeusCoursesUseCase,
  EnrollCourseUseCase,
  MeuProgressUseCase,
  GetMeuCourseUseCase,
} from '../application/use-cases/student.usecases.js';
import { DownloadQuery, ListCoursesQuery, EnrollInput } from './dtos.js';
@Controller('courses')
export class CoursesPublicController {
  constructor(
    private readonly listCourses: ListPublicCoursesUseCase,
    private readonly getCourse: GetCoursePublicUseCase,
    private readonly tracksUseCase: ListTracksUseCase,
  ) {}
  @Get()
  @Public()
  async list(
    @Query()
    query: ListCoursesQuery,
  ) {
    return this.listCourses.execute(query);
  }
  @Get('tracks')
  @Public()
  async tracks() {
    return this.tracksUseCase.execute();
  }
  @Get(':idOrSlug')
  @Public()
  async course(
    @Param('idOrSlug')
    idOrSlug: string,
  ) {
    return this.getCourse.execute({ idOrSlug });
  }
}
@Controller()
@Roles('STUDENT', 'MENTOR', 'ADMIN')
export class AreaStudentController {
  constructor(
    private readonly enroll: EnrollCourseUseCase,
    private readonly meusCourses: ListMeusCoursesUseCase,
    private readonly meuCourse: GetMeuCourseUseCase,
    private readonly completeLesson: CompleteLessonUseCase,
    private readonly progress: MeuProgressUseCase,
    private readonly concluidos: ListConcluidosUseCase,
    private readonly downloads: ListDownloadsUseCase,
  ) {}
  @Post('enrollments')
  async enrollEm(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: EnrollInput,
  ) {
    return this.enroll.execute({
      studentId: user.id,
      courseId: input.courseId,
    });
  }
  @Get('my-courses')
  async courses(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.meusCourses.execute({ studentId: user.id });
  }
  @Get('my-courses/:courseId')
  async um(
    @CurrentUser()
    user: AuthUser,
    @Param('courseId')
    courseId: string,
  ) {
    return this.meuCourse.execute({ studentId: user.id, courseId });
  }
  @Post('lessons/:lessonId/complete')
  @HttpCode(200)
  async complete(
    @CurrentUser()
    user: AuthUser,
    @Param('lessonId')
    lessonId: string,
  ) {
    return this.completeLesson.execute({ studentId: user.id, lessonId });
  }
  @Get('progress')
  async prog(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.progress.execute({ studentId: user.id });
  }
  @Get('completed')
  async done(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.concluidos.execute({ studentId: user.id });
  }
  @Get('downloads')
  async dl(
    @CurrentUser()
    user: AuthUser,
    @Query()
    query: DownloadQuery,
  ) {
    return this.downloads.execute({ studentId: user.id, type: query.type });
  }
}
