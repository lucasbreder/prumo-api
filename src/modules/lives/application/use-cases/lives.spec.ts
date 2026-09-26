import { describe, expect, it, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Live } from '../../domain/entities/live.entity.js';
import type { LiveReader, LiveWriter } from '../../domain/repositories.js';
import {
  ListAgendaLivesUseCase,
  RemoveLiveUseCase,
  SaveLiveUseCase,
  TransitionLiveUseCase,
} from './lives.usecases.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
class FakeLives implements LiveReader, LiveWriter {
  items = new Map<string, Live>();
  async list() {
    return [...this.items.values()];
  }
  async byId(id: string) {
    return this.items.get(id) ?? null;
  }
  async create(l: Live) {
    this.items.set(l.id, l);
  }
  async save(l: Live) {
    this.items.set(l.id, l);
  }
  async remove(id: string) {
    this.items.delete(id);
  }
}
const clock = { now: () => new Date('2026-09-04T12:00:00.000Z') };
describe('Lives', () => {
  let lives: FakeLives;
  let events: {
    name: string;
  }[];
  let deps: unknown;
  beforeEach(() => {
    lives = new FakeLives();
    events = [];
    deps = {
      lives,
      clock,
      events: { issue: (n: string) => events.push({ name: n }) },
    };
  });
  function live(title: string, quando: string, overrides = {}) {
    const l = Live.create({
      id: randomUUID(),
      title,
      description: 'd',
      type: 'LIVE',
      startsAt: new Date(quando),
      mentorName: null,
      ...overrides,
    });
    lives.items.set(l.id, l);
    return l;
  }
  it('agenda: ao vivo primeiro, próximas em ordem, encerradas por último', async () => {
    const passada = live('Passada', '2026-09-01T19:00:00Z', {
      roomUrl: 'https://meet/x',
    });
    passada.start();
    passada.end('https://play/x');
    live('Amanhã', '2026-09-05T19:00:00Z');
    const _hoje = live('Hoje', '2026-09-04T18:00:00Z');
    const liveNow = live('Agora', '2026-09-04T11:00:00Z', {
      roomUrl: 'https://meet/current',
    });
    liveNow.start();
    const agenda = await new ListAgendaLivesUseCase(deps as never).execute();
    expect(agenda.lives.map((l) => l.title)).toEqual([
      'Agora',
      'Hoje',
      'Amanhã',
      'Passada',
    ]);
  });
  it('exposição ao aluno esconde sala de agendada e mostra gravação de encerrada', async () => {
    const scheduled = live('Agendada', '2026-09-06T19:00:00Z', {
      roomUrl: 'https://meet/segredo',
    });
    const enc = live('Encerrada', '2026-09-01T19:00:00Z', {
      roomUrl: 'https://meet/e',
    });
    enc.start();
    enc.end('https://play/e');
    const agenda = await new ListAgendaLivesUseCase(deps as never).execute();
    const a = agenda.lives.find((l) => l.id === scheduled.id)!;
    const e = agenda.lives.find((l) => l.id === enc.id)!;
    expect(a.roomUrl).toBeNull();
    expect(e.recordingUrl).toBe('https://play/e');
  });
  it('salvar cria e edita; transições emitem eventos', async () => {
    const create = new SaveLiveUseCase(deps as never);
    const l = await create.execute({
      title: 'Nova live',
      description: 'x',
      type: 'LIVE',
      startsAt: '2026-09-10T19:00:00.000Z',
      durationMin: 90,
      roomUrl: 'https://meet/nova',
    });
    expect(lives.items.size).toBe(1);
    const trans = new TransitionLiveUseCase(deps as never);
    await trans.start(l.id);
    expect(lives.items.get(l.id)!.status).toBe('LIVE');
    await trans.end(l.id, 'https://play/nova');
    expect(events.map((e) => e.name)).toEqual([
      'lives.live_ao_vivo',
      'lives.live_encerrada',
    ]);
    await expect(trans.start('nao-existe')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const remove = new RemoveLiveUseCase(deps as never);
    await remove.execute(l.id);
    expect(lives.items.size).toBe(0);
  });
});
