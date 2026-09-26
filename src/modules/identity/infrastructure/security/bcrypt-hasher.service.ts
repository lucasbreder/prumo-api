import { Injectable } from '@nestjs/common';
import { hash, compare } from 'bcryptjs';
import { PasswordHasher } from '../../application/ports/ports.js';
const ROUNDS = 12;
@Injectable()
export class BcryptHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, ROUNDS);
  }
  comparar(password: string, hashValue: string): Promise<boolean> {
    return compare(password, hashValue);
  }
}
