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
  Query,
} from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import {
  AddLessonUseCase,
  AddModuleUseCase,
  RemoveCourseUseCase,
  RemoveLessonUseCase,
  ReviewLessonUseCase,
  SaveCourseUseCase,
  SaveMaterialUseCase,
} from '../application/use-cases/team.usecases.js';
import {
  ListCourseEnrollmentsAdminUseCase,
  ListAvailableStudentsAdminUseCase,
  EnrollStudentAdminUseCase,
  UnenrollStudentAdminUseCase,
} from '../application/use-cases/admin-enrollments.usecases.js';
import {
  COURSE_READER,
  MATERIAL_READER,
  MATERIAL_WRITER,
  MENTOR_LINK_WRITER,
  MODULE_READER,
  STORAGE_PRESIGNER,
} from '../domain/repositories.js';
import type {
  CourseReader,
  MaterialRow,
  MaterialWriter,
  MentorLinkWriter,
  MaterialReader,
  ModuleReader,
  StoragePresigner,
} from '../domain/repositories.js';
import { resolveAssetUrl, resolveBlockImages } from '../application/resolve-content-images.js';
import {
  ListCoursesAdminQuery,
  CreateLessonInput,
  CreateModuleInput,
  EnrollStudentAdminInput,
  ListMatriculasQuery,
  SaveCourseInput,
  LinkMentorInput,
  CreateMaterialInput,
  EditLessonInput,
  ChangeLessonStatusInput,
} from './dtos.js';
@Controller('admin/courses')
@Roles('ADMIN')
export class AdminCoursesController {
  constructor(
    @Inject(COURSE_READER)
    private readonly courses: CourseReader,
    @Inject(MODULE_READER)
    private readonly modules: ModuleReader,
    @Inject(STORAGE_PRESIGNER)
    private readonly presigner: StoragePresigner,
    private readonly saveCourse: SaveCourseUseCase,
    private readonly removeCourse: RemoveCourseUseCase,
    private readonly addModule: AddModuleUseCase,
    private readonly addLesson: AddLessonUseCase,
    private readonly removeLesson: RemoveLessonUseCase,
    private readonly review: ReviewLessonUseCase,
    private readonly listMatriculas: ListCourseEnrollmentsAdminUseCase,
    private readonly listAlunosDisponiveis: ListAvailableStudentsAdminUseCase,
    private readonly matricularAluno: EnrollStudentAdminUseCase,
    private readonly desmatricularAluno: UnenrollStudentAdminUseCase,
    @Inject(MENTOR_LINK_WRITER)
    private readonly links: MentorLinkWriter,
  ) {}
  @Get()
  async list(
    @Query()
    query: ListCoursesAdminQuery,
  ) {
    const { courses, total } = await this.courses.list(query);
    return {
      items: courses,
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      },
    };
  }
  @Get(':id/curriculum')
  async curriculum(
    @Param('id')
    id: string,
  ) {
    const course = await this.courses.byId(id);
    const [lessons, modules] = await Promise.all([
      this.courses.curriculum(id, false),
      this.modules.listByCourse(id),
    ]);
    return {
      course: course
        ? { id: course.id, title: course.title, status: course.status }
        : null,
      modules,
      lessons: await Promise.all(
        lessons.map(async (a) => ({
          ...a,
          contentUrlSigned: await resolveAssetUrl(a.contentUrl, (k) =>
            this.presigner.resolvePublicUrl(k),
          ),
          videoUrlSigned: await resolveAssetUrl(a.videoUrl, (k) =>
            this.presigner.resolvePublicUrl(k),
          ),
          materialUrlSigned: await resolveAssetUrl(a.materialUrl, (k) =>
            this.presigner.resolvePublicUrl(k),
          ),
          blocks: await resolveBlockImages(a.blocks, (k) =>
            this.presigner.resolvePublicUrl(k),
          ),
        })),
      ),
    };
  }
  @Post()
  async create(
    @Body()
    input: SaveCourseInput,
  ) {
    const course = await this.saveCourse.execute(input);
    return { course: forViewCourse(course) };
  }
  @Get(':id/enrollments')
  async matriculas(
    @Param('id')
    id: string,
    @Query()
    query: ListMatriculasQuery,
  ) {
    return this.listMatriculas.execute({
      courseId: id,
      search: query.search,
      page: query.page,
      perPage: query.perPage,
    });
  }
  @Get(':id/enrollments/available-students')
  async alunosDisponiveis(
    @Param('id')
    id: string,
    @Query('search')
    search?: string,
  ) {
    return this.listAlunosDisponiveis.execute({ courseId: id, search });
  }
  @Post(':id/enrollments')
  @HttpCode(201)
  async matricular(
    @Param('id')
    courseId: string,
    @Body()
    input: EnrollStudentAdminInput,
  ) {
    return this.matricularAluno.execute({
      courseId,
      studentId: input.studentId,
    });
  }
  @Delete(':id/enrollments/:studentId')
  @HttpCode(204)
  async desmatricular(
    @Param('id')
    courseId: string,
    @Param('studentId')
    studentId: string,
  ): Promise<void> {
    await this.desmatricularAluno.execute({ courseId, studentId });
  }
  @Patch(':id')
  async update(
    @Param('id')
    id: string,
    @Body()
    input: SaveCourseInput,
  ) {
    const course = await this.saveCourse.execute({ ...input, id });
    return { course: forViewCourse(course) };
  }
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id')
    id: string,
  ): Promise<void> {
    await this.removeCourse.execute({ courseId: id });
  }
  @Post(':id/modules')
  async module(
    @Param('id')
    courseId: string,
    @Body()
    input: CreateModuleInput,
  ) {
    return this.addModule.execute({ courseId, title: input.title });
  }
  @Post(':id/mentors')
  @HttpCode(201)
  async link(
    @Param('id')
    courseId: string,
    @Body()
    input: LinkMentorInput,
  ) {
    await this.links.link(courseId, input.mentorId, input.role ?? 'AUTHOR');
    return { linked: true };
  }
  @Delete(':id/mentors/:mentorId')
  @HttpCode(204)
  async unlink(
    @Param('id')
    courseId: string,
    @Param('mentorId')
    mentorId: string,
  ): Promise<void> {
    await this.links.unlink(courseId, mentorId);
  }
  @Post('modules/:moduleId/lessons')
  async lesson(
    @Param('moduleId')
    moduleId: string,
    @Body()
    input: Omit<CreateLessonInput, 'moduleId'>,
  ) {
    return this.addLesson.execute({ ...input, moduleId });
  }
  @Post('lessons/:lessonId/approve')
  @HttpCode(200)
  async approve(
    @Param('lessonId')
    lessonId: string,
  ) {
    return this.review.approve(lessonId);
  }
  @Patch('lessons/:lessonId')
  async edit(
    @Param('lessonId')
    lessonId: string,
    @Body()
    input: EditLessonInput,
  ) {
    return this.review.editAsTeam(lessonId, input);
  }
  @Patch('lessons/:lessonId/status')
  async changeStatus(
    @Param('lessonId')
    lessonId: string,
    @Body()
    input: ChangeLessonStatusInput,
  ) {
    return this.review.setStatus(lessonId, input.status);
  }
  @Post('lessons/:lessonId/reject')
  @HttpCode(200)
  async reject(
    @Param('lessonId')
    lessonId: string,
  ) {
    return this.review.reject(lessonId);
  }
  @Delete('lessons/:lessonId')
  @HttpCode(204)
  async removeLessonById(
    @Param('lessonId')
    lessonId: string,
  ): Promise<void> {
    await this.removeLesson.execute({ lessonId });
  }
}
@Controller('admin/materials')
@Roles('ADMIN')
export class AdminMaterialsController {
  constructor(
    @Inject(MATERIAL_READER)
    private readonly reader: MaterialReader,
    @Inject(MATERIAL_WRITER)
    private readonly writer: MaterialWriter,
    private readonly createMaterialUseCase: SaveMaterialUseCase,
  ) {}
  @Get()
  async list(
    @Query('courseId')
    courseId?: string,
  ) {
    const materials: MaterialRow[] = courseId
      ? await this.reader.listByCourse(courseId)
      : await this.reader.listAll();
    return { materials };
  }
  @Post()
  async create(
    @Body()
    input: CreateMaterialInput,
  ) {
    return this.createMaterialUseCase.execute(input);
  }
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id')
    id: string,
  ): Promise<void> {
    await this.writer.remove(id);
  }
}
function forViewCourse(
  c: import('../domain/entities/course.entity.js').Course,
) {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    track: c.track,
    description: c.description,
    status: c.status,
    coverUrl: c.coverUrl,
    featured: c.featured,
    order: c.order,
  };
}
