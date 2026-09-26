import { randomUUID } from 'node:crypto';
import { Live } from '../../domain/entities/live.entity.js';
import type { LiveReader, LiveWriter } from '../../domain/repositories.js';
import { LivesEvents } from '../../domain/repositories.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
interface Pub {
  issue(name: string, payload: unknown): void;
}
export interface LivesDeps {
  lives: LiveReader & LiveWriter;
  clock: Clock;
  events: Pub;
}
export function toAdminView(l: Live) {
  return { ...toStudentView(l), roomUrl: l.roomUrl };
}
export function toStudentView(l: Live) {
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    type: l.type,
    mentorName: l.mentorName,
    startsAt: l.startsAt.toISOString(),
    durationMin: l.durationMin,
    status: l.status,
    roomUrl: l.urlRoomVisibleAoStudent(),
    recordingUrl: l.status === 'ENDED' ? l.recordingUrl : null,
  };
}
export class ListAgendaLivesUseCase {
  constructor(private readonly deps: LivesDeps) {}
  async execute() {
    const lives = await this.deps.lives.list();
    const current = this.deps.clock.now().getTime();
    const sorted = [...lives].sort((a, b) => {
      const peso = (l: Live) =>
        l.status === 'LIVE' ? 0 : l.startsAt.getTime() >= current ? 1 : 2;
      return (
        peso(a) - peso(b) ||
        (peso(a) === 2
          ? b.startsAt.getTime() - a.startsAt.getTime()
          : a.startsAt.getTime() - b.startsAt.getTime())
      );
    });
    return { lives: sorted.map(toStudentView) };
  }
}
export interface SaveLiveInput {
  id?: string;
  title: string;
  description: string;
  type: 'LIVE' | 'MENTORING';
  startsAt: string;
  durationMin: number;
  roomUrl?: string | null;
  recordingUrl?: string | null;
  mentorName?: string | null;
}
export class SaveLiveUseCase {
  constructor(private readonly deps: LivesDeps) {}
  async execute(input: SaveLiveInput): Promise<Live> {
    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new NotFoundError('dataInicio invalido');
    }
    if (input.id) {
      const live = await this.deps.lives.byId(input.id);
      if (!live) throw new NotFoundError('Live nao encontrada');
      live.editar({
        title: input.title,
        description: input.description,
        startsAt,
        durationMin: input.durationMin,
        roomUrl: input.roomUrl ?? null,
        recordingUrl: input.recordingUrl ?? live.recordingUrl,
        mentorName: input.mentorName ?? null,
      });
      await this.deps.lives.save(live);
      return live;
    }
    const live = Live.create({
      id: randomUUID(),
      title: input.title,
      description: input.description,
      type: input.type,
      startsAt,
      durationMin: input.durationMin,
      roomUrl: input.roomUrl ?? null,
      mentorName: input.mentorName ?? null,
    });
    await this.deps.lives.create(live);
    return live;
  }
}
export class TransitionLiveUseCase {
  constructor(private readonly deps: LivesDeps) {}
  async start(id: string): Promise<Live> {
    const live = await this.exigir(id);
    live.start();
    await this.deps.lives.save(live);
    this.deps.events.issue(LivesEvents.LIVE_AO_VIVO, {
      id,
      roomUrl: live.roomUrl,
    });
    return live;
  }
  async end(id: string, recordingUrl: string | null): Promise<Live> {
    const live = await this.exigir(id);
    live.end(recordingUrl);
    await this.deps.lives.save(live);
    this.deps.events.issue(LivesEvents.LIVEEnded, { id, recordingUrl });
    return live;
  }
  private async exigir(id: string): Promise<Live> {
    const live = await this.deps.lives.byId(id);
    if (!live) throw new NotFoundError('Live nao encontrada');
    return live;
  }
}
export class RemoveLiveUseCase {
  constructor(private readonly deps: LivesDeps) {}
  async execute(id: string): Promise<void> {
    const live = await this.deps.lives.byId(id);
    if (!live) throw new NotFoundError('Live nao encontrada');
    await this.deps.lives.remove(id);
  }
}
