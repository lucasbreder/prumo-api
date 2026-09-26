import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Live } from './live.entity.js';
import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
function scheduled(overrides = {}) {
  return Live.create({
    id: randomUUID(),
    title: 'Live: precificação na prática',
    description: 'Casos reais ao vivo.',
    type: 'LIVE',
    startsAt: new Date('2026-09-10T19:00:00.000Z'),
    durationMin: 60,
    mentorName: 'Marina Sole',
    ...overrides,
  });
}
describe('Live', () => {
  it('nasce agendada', () => {
    expect(scheduled().status).toBe('SCHEDULED');
  });
  it('só entra ao vivo com sala definida', () => {
    const l = scheduled();
    expect(() => l.start()).toThrow(BusinessRuleError);
    l.editar({ roomUrl: 'https://meet.prumo.dev/abc' });
    l.start();
    expect(l.status).toBe('LIVE');
  });
  it('encerra publicando a gravação', () => {
    const l = scheduled({ roomUrl: 'https://meet/x' });
    l.start();
    l.end('https://play.prumo.dev/gravacao-1');
    expect(l.status).toBe('ENDED');
    expect(l.recordingUrl).toBe('https://play.prumo.dev/gravacao-1');
  });
  it('não inicia duas vezes nem encerra agendada', () => {
    const l = scheduled({ roomUrl: 'https://meet/x' });
    l.start();
    expect(() => l.start()).toThrow(/ao vivo/i);
    const l2 = scheduled();
    expect(() => l2.end(null)).toThrow();
  });
  it('exposicao publica esconde a sala quando nao esta ao vivo', () => {
    const l = scheduled({ roomUrl: 'https://meet/x' });
    expect(l.urlRoomVisibleAoStudent()).toBeNull();
    l.start();
    expect(l.urlRoomVisibleAoStudent()).toBe('https://meet/x');
  });
  it('mentoria exige mentor nomeado', () => {
    expect(() => scheduled({ type: 'MENTORING', mentorName: null })).toThrow(
      /mentor/i,
    );
  });
});
