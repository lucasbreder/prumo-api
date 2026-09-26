export interface EnrollmentProps {
  id: string;
  studentId: string;
  courseId: string;
  progressPercent: number;
  currentLessonId: string | null;
  completedAt: Date | null;
}
export class Enrollment {
  private constructor(private readonly props: EnrollmentProps) {}
  static create(data: {
    id: string;
    studentId: string;
    courseId: string;
  }): Enrollment {
    return new Enrollment({
      ...data,
      progressPercent: 0,
      currentLessonId: null,
      completedAt: null,
    });
  }
  static reconstituir(props: EnrollmentProps): Enrollment {
    return new Enrollment(props);
  }
  get id(): string {
    return this.props.id;
  }
  get studentId(): string {
    return this.props.studentId;
  }
  get courseId(): string {
    return this.props.courseId;
  }
  get progressPercent(): number {
    return this.props.progressPercent;
  }
  get currentLessonId(): string | null {
    return this.props.currentLessonId;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  /**
   * Progress = lessons concluidas / lessons published do course.
   * Conclusao e reavaliada a each recalcular (nova lesson publicada reabre).
   */
  recalcularProgress(
    data: {
      totalPublicadas: number;
      concluidas: number;
    },
    current: Date = new Date(),
  ): void {
    if (data.totalPublicadas <= 0) {
      this.props.progressPercent = 0;
      this.props.completedAt = null;
      return;
    }
    const pct = Math.floor((data.concluidas / data.totalPublicadas) * 100);
    this.props.progressPercent = Math.min(100, Math.max(0, pct));
    if (data.concluidas >= data.totalPublicadas) {
      this.props.completedAt ??= current;
    } else {
      this.props.completedAt = null;
    }
  }
  definirLessonCurrent(lessonId: string | null): void {
    this.props.currentLessonId = lessonId;
  }
}
