import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PagedQueryInput } from '../../../shared/pagination/pagination.js';
const TypesLesson = ['VIDEO', 'QUIZ', 'MATERIAL', 'TEXT'] as const;
const TypesMATERIAL = [
  'PDF',
  'SPREADSHEET',
  'TEMPLATE',
  'EBOOK',
  'CHECKLIST',
  'PRESENTATION',
] as const;
export class ListCoursesQuery extends PagedQueryInput {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  track?: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
export class ListCoursesAdminQuery extends PagedQueryInput {
  @IsOptional()
  @IsIn(['PUBLISHED', 'DRAFT'])
  status?: 'PUBLISHED' | 'DRAFT';
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
export class EnrollInput {
  @IsString()
  @IsNotEmpty()
  courseId!: string;
}
export class EnrollStudentAdminInput {
  @IsString()
  @IsNotEmpty()
  studentId!: string;
}
export class ListMatriculasQuery extends PagedQueryInput {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
export class DownloadQuery {
  @IsOptional()
  @IsIn(TypesMATERIAL)
  type?: (typeof TypesMATERIAL)[number];
}
export class SaveCourseInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MaxLength(180)
  slug?: string;
  @IsOptional()
  @IsString()
  @MaxLength(60)
  track?: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  publish?: boolean;
}
export class CreateModuleInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;
}
export class CreateLessonInput {
  @IsOptional()
  @IsString()
  moduleId?: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;
  @IsEnum({ VIDEO: 'VIDEO', QUIZ: 'QUIZ', MATERIAL: 'MATERIAL', TEXT: 'TEXT' })
  type!: (typeof TypesLesson)[number];
  @IsOptional()
  @IsString()
  @MaxLength(500)
  contentUrl?: string;
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  text?: string;
  @IsOptional()
  @IsArray()
  blocks?: unknown[];
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  durationSeconds?: number;
}
export class EditLessonInput {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
  @IsOptional()
  @IsIn(TypesLesson)
  type?: (typeof TypesLesson)[number];
  @IsOptional()
  @IsString()
  @MaxLength(500)
  contentUrl?: string;
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  text?: string;
  @IsOptional()
  @IsArray()
  blocks?: unknown[];
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  durationSeconds?: number;
}
export class ChangeLessonStatusInput {
  @IsIn(['DRAFT', 'IN_REVIEW', 'PUBLISHED'])
  status!: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
}
export class LinkMentorInput {
  @IsString()
  @IsNotEmpty()
  mentorId!: string;
  @IsOptional()
  @IsIn(['AUTHOR', 'COAUTHOR'])
  role?: 'AUTHOR' | 'COAUTHOR';
}
export class CreateMaterialInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
  @IsIn(TypesMATERIAL)
  type!: (typeof TypesMATERIAL)[number];
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  url!: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
  @IsOptional()
  @IsString()
  courseId?: string;
  @IsOptional()
  @IsString()
  moduleId?: string;
  @IsOptional()
  @IsString()
  lessonId?: string;
}
export class PresignUploadInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameArquivo!: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
