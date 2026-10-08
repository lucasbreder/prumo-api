import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../shared/auth/auth-user.types.js';
import {
  AddLessonComoMentorUseCase,
  AddModuleComoMentorUseCase,
  EditLessonAsMentorUseCase,
  RemoveLessonComoMentorUseCase,
  SendLessonForReviewUseCase,
  ListCoursesDoMentorUseCase,
  ListMaterialsDoMentorUseCase,
  GetCurriculumDoMentorUseCase,
} from '../application/use-cases/mentor.usecases.js';
import {
  CreateLessonInput,
  CreateModuleInput,
  EditLessonInput,
} from './dtos.js';
@Controller('mentor')
@Roles('MENTOR')
export class MentorMaterialsController {
  constructor(private readonly listMaterials: ListMaterialsDoMentorUseCase) {}
  @Get('materials')
  async materials(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.listMaterials.execute({ mentorId: user.id });
  }
}
@Controller('mentor/courses')
@Roles('MENTOR')
export class MentorController {
  constructor(
    private readonly listCourses: ListCoursesDoMentorUseCase,
    private readonly curriculum: GetCurriculumDoMentorUseCase,
    private readonly addModule: AddModuleComoMentorUseCase,
    private readonly addLesson: AddLessonComoMentorUseCase,
    private readonly editLesson: EditLessonAsMentorUseCase,
    private readonly removeLesson: RemoveLessonComoMentorUseCase,
  ) {}
  @Get()
  async courses(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.listCourses.execute({ mentorId: user.id });
  }
  @Get(':courseId')
  async um(
    @CurrentUser()
    user: AuthUser,
    @Param('courseId')
    courseId: string,
  ) {
    return this.curriculum.execute({ mentorId: user.id, courseId });
  }
  @Post(':courseId/modules')
  async module(
    @CurrentUser()
    user: AuthUser,
    @Param('courseId')
    courseId: string,
    @Body()
    input: CreateModuleInput,
  ) {
    return this.addModule.execute({
      mentorId: user.id,
      courseId,
      title: input.title,
    });
  }
  @Post(':courseId/lessons')
  async lesson(
    @CurrentUser()
    user: AuthUser,
    @Param('courseId')
    courseId: string,
    @Body()
    input: CreateLessonInput,
  ) {
    return this.addLesson.execute({
      mentorId: user.id,
      courseId,
      moduleId: input.moduleId,
      title: input.title,
      type: input.type,
      contentUrl: input.contentUrl,
      text: input.text,
      blocks: input.blocks,
      durationSeconds: input.durationSeconds,
    });
  }
  @Patch('lessons/:lessonId')
  async edit(
    @CurrentUser()
    user: AuthUser,
    @Param('lessonId')
    lessonId: string,
    @Body()
    input: EditLessonInput,
  ) {
    return this.editLesson.execute({
      mentorId: user.id,
      lessonId,
      data: input,
    });
  }
  @Delete('lessons/:lessonId')
  @HttpCode(204)
  async remove(
    @CurrentUser()
    user: AuthUser,
    @Param('lessonId')
    lessonId: string,
  ) {
    await this.removeLesson.execute({ mentorId: user.id, lessonId });
  }
}
@Controller()
@Roles('MENTOR')
export class LessonReviewController {
  constructor(private readonly send: SendLessonForReviewUseCase) {}
  @Post('lessons/:lessonId/review')
  @HttpCode(202)
  async review(
    @CurrentUser()
    user: AuthUser,
    @Param('lessonId')
    lessonId: string,
  ) {
    return this.send.execute({ mentorId: user.id, lessonId });
  }
}
