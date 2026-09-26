import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { GeradorToken, TokenGerado } from '../../application/ports/ports.js';
@Injectable()
export class CryptoTokenGenerator implements GeradorToken {
  generate(): TokenGerado {
    const raw = randomBytes(48).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }
  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
