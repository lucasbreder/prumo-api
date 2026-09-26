import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PublicadorEvents } from '../domain/publisher.js';
@Injectable()
export class NestEventPublisher implements PublicadorEvents {
  constructor(private readonly emitter: EventEmitter2) {}
  issue(name: string, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
