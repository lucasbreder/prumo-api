import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
export class Password {
  private constructor(readonly raw: string) {}
  static fromRaw(raw: string): Password {
    if (raw.length < 8) {
      throw new BusinessRuleError('A senha deve ter no minimo 8 caracteres');
    }
    if (!/[a-zA-Z]/.test(raw)) {
      throw new BusinessRuleError('A senha deve conter ao menos uma letra');
    }
    if (!/\d/.test(raw)) {
      throw new BusinessRuleError('A senha deve conter ao menos um numero');
    }
    return new Password(raw);
  }
}
