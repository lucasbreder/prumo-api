import { randomUUID } from 'node:crypto';
import {
  LessonReader,
  LessonWriter,
  CourseReader,
  CourseWriter,
  MaterialWriter,
  ModuleReader,
  ModuleWriter,
  StoragePresigner,
} from '../../domain/repositories.js';
import { Course } from '../../domain/entities/course.entity.js';
import { Lesson } from '../../domain/entities/lesson.entity.js';
import {
  NotFoundError,
  BusinessRuleError,
} from '../../../../shared/errors/domain.errors.js';
export interface EquipeDeps {
  courses: CourseReader & CourseWriter;
  lessons: LessonReader;
  lessonsWriter: LessonWriter;
  modules: ModuleReader & ModuleWriter;
  materials: MaterialWriter;
  presigner: StoragePresigner;
}
export interface SaveCourseInput {
  id?: string;
  title: string;
  slug?: string;
  track?: string | null;
  description: string;
  coverUrl?: string | null;
  featured?: boolean;
  order?: number;
  publish?: boolean;
}
export class SaveCourseUseCase {
  constructor(private readonly deps: EquipeDeps) {}
  async execute(input: SaveCourseInput): Promise<Course> {
    if (input.id) {
      const course = await this.deps.courses.byId(input.id);
      if (!course) throw new NotFoundError('Curso nao encontrado');
      course.editar({
        title: input.title,
        slug: input.slug,
        track: input.track ?? null,
        description: input.description,
        coverUrl: input.coverUrl ?? null,
        featured: input.featured ?? course.featured,
        order: input.order ?? course.order,
      });
      if (input.publish === true) {
        course.publish(await this.deps.courses.temLessonPublicada(course.id));
      } else if (input.publish === false) {
        course.despublicar();
      }
      await this.deps.courses.save(course);
      return course;
    }
    const course = Course.create({
      id: randomUUID(),
      title: input.title,
      description: input.description,
      slug: input.slug,
      track: input.track,
      coverUrl: input.coverUrl,
      featured: input.featured,
      order: input.order,
    });
    await this.deps.courses.create(course);
    return course;
  }
}
export class AddModuleUseCase {
  constructor(private readonly deps: EquipeDeps) {}
  async execute(input: { courseId: string; title: string }) {
    const course = await this.deps.courses.byId(input.courseId);
    if (!course) throw new NotFoundError('Curso nao encontrado');
    const order = await this.deps.modules.nextOrder(input.courseId);
    const module = {
      id: randomUUID(),
      courseId: input.courseId,
      order,
      title: input.title,
    };
    await this.deps.modules.create(module);
    return module;
  }
}
export class AddLessonUseCase {
  constructor(private readonly deps: EquipeDeps) {}
  async execute(input: {
    moduleId?: string;
    title: string;
    type: 'VIDEO' | 'QUIZ' | 'MATERIAL' | 'TEXT';
    contentUrl?: string;
    videoUrl?: string;
    materialUrl?: string;
    text?: string;
    blocks?: unknown;
    durationSeconds?: number;
  }) {
    if (!input.moduleId) {
      throw new NotFoundError('Modulo nao informado');
    }
    const module = await this.deps.modules.byId(input.moduleId);
    if (!module) throw new NotFoundError('Modulo nao encontrado');
    const curriculum = await this.deps.courses.curriculum(
      module.courseId,
      false,
    );
    const order =
      curriculum.filter((a) => a.moduleId === input.moduleId).length + 1;
    const lesson = Lesson.create({
      id: randomUUID(),
      moduleId: module.id,
      order,
      type: input.type,
      title: input.title,
      contentUrl: input.contentUrl,
      videoUrl: input.videoUrl,
      materialUrl: input.materialUrl,
      text: input.text,
      blocks: input.blocks,
      durationSeconds: input.durationSeconds,
    });
    await this.deps.lessonsWriter.create(lesson, module.courseId);
    return { id: lesson.id, status: lesson.status, order };
  }
}
export class RemoveLessonUseCase {
  constructor(private readonly deps: EquipeDeps) {}
  async execute(input: { lessonId: string }) {
    const referencia = await this.deps.lessons.byId(input.lessonId);
    if (!referencia) throw new NotFoundError('Aula nao encontrada');
    await this.deps.lessonsWriter.remove(input.lessonId);
    return { id: input.lessonId };
  }
}
export class RemoveCourseUseCase {
  constructor(private readonly deps: EquipeDeps) {}
  async execute(input: { courseId: string }) {
    const course = await this.deps.courses.byId(input.courseId);
    if (!course) throw new NotFoundError('Curso nao encontrado');
    await this.deps.courses.remove(input.courseId);
    return { id: input.courseId };
  }
}
export class ReviewLessonUseCase {
  constructor(private readonly deps: EquipeDeps) {}
  private async get(lessonId: string) {
    const referencia = await this.deps.lessons.byId(lessonId);
    if (!referencia) throw new NotFoundError('Aula nao encontrada');
    return referencia;
  }
  async editAsTeam(
    lessonId: string,
    data: Parameters<Lesson['editContent']>[0],
  ): Promise<{ id: string; status: string }> {
    const { lesson } = await this.get(lessonId);
    // Equipe can edit without forcing a new review cycle.
    lesson.editContent(data, true);
    await this.deps.lessonsWriter.save(lesson);
    return { id: lesson.id, status: lesson.status };
  }
  async approve(lessonId: string): Promise<{
    id: string;
    status: string;
  }> {
    const { lesson } = await this.get(lessonId);
    lesson.publish();
    await this.deps.lessonsWriter.save(lesson);
    return { id: lesson.id, status: lesson.status };
  }
  async reject(lessonId: string): Promise<{
    id: string;
    status: string;
  }> {
    const { lesson } = await this.get(lessonId);
    lesson.rejeitar();
    await this.deps.lessonsWriter.save(lesson);
    return { id: lesson.id, status: lesson.status };
  }
  // Equipe/admin alterna o status diretamente (rascunho <-> publicado).
  async setStatus(
    lessonId: string,
    status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED',
  ): Promise<{ id: string; status: string }> {
    const { lesson } = await this.get(lessonId);
    lesson.definirStatus(status, new Date());
    await this.deps.lessonsWriter.save(lesson);
    return { id: lesson.id, status: lesson.status };
  }
}
export class SaveMaterialUseCase {
  constructor(private readonly deps: EquipeDeps) {}
  async execute(input: {
    name: string;
    type: string;
    url: string;
    sizeBytes: number;
    courseId?: string | null;
    moduleId?: string | null;
    lessonId?: string | null;
  }) {
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new BusinessRuleError('Tamanho do arquivo invalido');
    }
    const id = randomUUID();
    await this.deps.materials.create({ ...input, id });
    return { id };
  }
}
const TypeByEXTENSAO: Record<string, string> = {
  mp4: 'video/mp4',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};
// Aulas/materiais: 20 GB via multipart (um PUT unico no S3 limita a 5 GB).
export const MAX_LESSON_UPLOAD_BYTES = 20 * 1024 * 1024 * 1024;
const MULTIPART_PART_BYTES = 100 * 1024 * 1024; // 100 MB por parte
const MULTIPART_PART_TTL_SECONDS = 3600;
const MSG_FORMATOS =
  'Formato nao suportado (use MP4, PDF, PPTX, XLSX, DOCX, CSV, JPG, PNG, WEBP ou AVIF)';

function chaveDeUpload(
  userId: string,
  nameArquivo: string,
  sizeBytes: number,
): { chave: string; typeContent: string } {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new BusinessRuleError('Tamanho invalido');
  }
  const extensao = nameArquivo.split('.').pop()?.toLowerCase() ?? '';
  const typeContent = TypeByEXTENSAO[extensao];
  if (!typeContent) {
    throw new BusinessRuleError(MSG_FORMATOS);
  }
  const seguro = nameArquivo.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return { chave: `uploads/${userId}/${randomUUID()}-${seguro}`, typeContent };
}

export class PresignUploadUseCase {
  constructor(
    private readonly deps: {
      presigner: StoragePresigner;
    },
  ) {}
  async execute(input: {
    userId: string;
    nameArquivo: string;
    sizeBytes: number;
  }): Promise<{
    url: string;
    expiraEm: string;
    chave: string;
    previewUrl: string | null;
  }> {
    const { chave, typeContent } = chaveDeUpload(
      input.userId,
      input.nameArquivo,
      input.sizeBytes,
    );
    const { url, expiraEm } = await this.deps.presigner.presignUpload({
      chave,
      typeContent,
    });
    const previewUrl = await this.deps.presigner.resolvePublicUrl(chave);
    return { url, expiraEm, chave, previewUrl };
  }
}

export interface MultipartPart {
  parte: number;
  url: string;
  expiraEm: string;
}

export class InitiateMultipartUploadUseCase {
  constructor(
    private readonly deps: {
      presigner: StoragePresigner;
    },
  ) {}
  async execute(input: {
    userId: string;
    nameArquivo: string;
    sizeBytes: number;
  }): Promise<{
    chave: string;
    uploadId: string;
    previewUrl: string | null;
    partSize: number;
    partes: MultipartPart[];
  }> {
    if (input.sizeBytes > MAX_LESSON_UPLOAD_BYTES) {
      throw new BusinessRuleError('Arquivo excede o limite de 20 GB');
    }
    const { chave, typeContent } = chaveDeUpload(
      input.userId,
      input.nameArquivo,
      input.sizeBytes,
    );
    const { uploadId } = await this.deps.presigner.createMultipartUpload({
      chave,
      typeContent,
    });
    const totalPartes = Math.ceil(input.sizeBytes / MULTIPART_PART_BYTES);
    const partes: MultipartPart[] = [];
    for (let parte = 1; parte <= totalPartes; parte++) {
      const { url, expiraEm } = await this.deps.presigner.presignUploadPart({
        chave,
        uploadId,
        parte,
        expiraEmSeconds: MULTIPART_PART_TTL_SECONDS,
      });
      partes.push({ parte, url, expiraEm });
    }
    const previewUrl = await this.deps.presigner.resolvePublicUrl(chave);
    return {
      chave,
      uploadId,
      previewUrl,
      partSize: MULTIPART_PART_BYTES,
      partes,
    };
  }
}

export class CompleteMultipartUploadUseCase {
  constructor(
    private readonly deps: {
      presigner: StoragePresigner;
    },
  ) {}
  async execute(input: {
    chave: string;
    uploadId: string;
    partes: { parte: number; etag: string }[];
  }): Promise<{ chave: string }> {
    if (!input.chave || !input.uploadId) {
      throw new BusinessRuleError('Upload invalido');
    }
    if (!Array.isArray(input.partes) || input.partes.length === 0) {
      throw new BusinessRuleError('Partes nao informadas');
    }
    const partes = [...input.partes].sort((a, b) => a.parte - b.parte);
    await this.deps.presigner.completeMultipartUpload({
      chave: input.chave,
      uploadId: input.uploadId,
      partes,
    });
    return { chave: input.chave };
  }
}

export class AbortMultipartUploadUseCase {
  constructor(
    private readonly deps: {
      presigner: StoragePresigner;
    },
  ) {}
  async execute(input: {
    chave: string;
    uploadId: string;
  }): Promise<{ ok: true }> {
    if (input.chave && input.uploadId) {
      await this.deps.presigner.abortMultipartUpload(input);
    }
    return { ok: true };
  }
}
