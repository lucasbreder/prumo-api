import { describe, expect, it } from 'vitest';
import { Password } from './password.vo.js';
describe('Senha (value object)', () => {
  it('aceita senha forte', () => {
    const password = Password.fromRaw('prumo2026#arq');
    expect(password.raw.length).toBeGreaterThanOrEqual(8);
  });
  it('rejeita senha curta', () => {
    expect(() => Password.fromRaw('a1bcd')).toThrow(/no minimo 8/);
  });
  it('rejeita senha sem digito', () => {
    expect(() => Password.fromRaw('somenteletras')).toThrow(/numero/i);
  });
  it('rejeita senha sem letra', () => {
    expect(() => Password.fromRaw('12345678')).toThrow(/letra/i);
  });
});
