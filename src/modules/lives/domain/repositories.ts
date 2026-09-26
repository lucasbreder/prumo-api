import { Live } from './entities/live.entity.js';
export const LIVE_READER = 'LIVE_READER' as const;
export const LIVE_WRITER = 'LIVE_WRITER' as const;
export interface LiveReader {
  list(): Promise<Live[]>;
  byId(id: string): Promise<Live | null>;
}
export interface LiveWriter {
  create(live: Live): Promise<void>;
  save(live: Live): Promise<void>;
  remove(id: string): Promise<void>;
}
export const LivesEvents = {
  LIVE_AO_VIVO: 'lives.live_ao_vivo',
  LIVEEnded: 'lives.live_encerrada',
} as const;
