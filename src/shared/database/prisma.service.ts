import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { ENV_TOKEN } from '../config/env.js';
import type { AppEnv } from '../config/env.js';
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject(ENV_TOKEN)
    env: AppEnv,
  ) {
    super({
      // Prisma 7: without query engine Rust; conexao via driver adapter.
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    });
  }
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
