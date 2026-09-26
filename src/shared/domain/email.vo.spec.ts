import { describe, expect, it } from 'vitest';
import { Email } from './email.vo.js';
describe('Email (value object)', () => {
  it('cria e normaliza para minusculas', () => {
    const email = Email.from('Ana@Prumo.Com.br ');
    expect(email.value).toBe('ana@prumo.com.br');
  });
  it('rejeita string sem @', () => {
    expect(() => Email.from('foo')).toThrow(/invalido/i);
  });
  it('rejeita dominio sem ponto', () => {
    expect(() => Email.from('a@b')).toThrow(/invalido/i);
  });
  it('rejeita vazio', () => {
    expect(() => Email.from('')).toThrow(/invalido/i);
  });
  it('aceita formatos reais', () => {
    for (const value of [
      'a@b.co',
      'maria.silva+arq@estudio.com.br',
      'lucas_z@prumo.io',
    ]) {
      expect(Email.from(value).value).toBe(value);
    }
  });
  it('e igual por valor', () => {
    expect(Email.from('A@B.co').equals(Email.from('a@b.CO'))).toBe(true);
  });
});
