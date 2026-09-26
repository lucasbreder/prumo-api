import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Live } from '../../domain/entities/live.entity.js';
import type { LiveReader, LiveWriter } from '../../domain/repositories.js';
import { Prisma } from '../../../../generated/prisma/client.js';
const Fields = {
  id: true,
  title: true,
  description: true,
  type: true,
  startsAt: true,
  durationMin: true,
  roomUrl: true,
  recordingUrl: true,
  status: true,
  mentorName: true,
} satisfies Prisma.LiveSelect;
type LiveRow = Prisma.LiveGetPayload<{
  select: typeof Fields;
}>;
function forEntidade(row: LiveRow): Live {
  return Live.reconstituir({
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type as 'LIVE' | 'MENTORING',
    startsAt: row.startsAt,
    durationMin: row.durationMin,
    roomUrl: row.roomUrl,
    recordingUrl: row.recordingUrl,
    status: row.status as 'SCHEDULED' | 'LIVE' | 'ENDED',
    mentorName: row.mentorName,
  });
}
function forEscritura(live: Live) {
  return {
    title: live.title,
    description: live.description,
    type: live.type,
    startsAt: live.startsAt,
    durationMin: live.durationMin,
    roomUrl: live.roomUrl,
    recordingUrl: live.recordingUrl,
    status: live.status,
    mentorName: live.mentorName,
  };
}
@Injectable()
export class PrismaLiveRepository implements LiveReader, LiveWriter {
  constructor(private readonly prisma: PrismaService) {}
  async list(): Promise<Live[]> {
    const rows = await this.prisma.live.findMany({
      orderBy: { startsAt: 'asc' },
      select: Fields,
    });
    return rows.map(forEntidade);
  }
  async byId(id: string): Promise<Live | null> {
    const row = await this.prisma.live.findUnique({
      where: { id },
      select: Fields,
    });
    return row ? forEntidade(row) : null;
  }
  async create(live: Live): Promise<void> {
    await this.prisma.live.create({
      data: { id: live.id, ...forEscritura(live) },
    });
  }
  async save(live: Live): Promise<void> {
    await this.prisma.live.update({
      where: { id: live.id },
      data: forEscritura(live),
    });
  }
  async remove(id: string): Promise<void> {
    await this.prisma.live.delete({ where: { id } });
  }
}
