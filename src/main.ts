import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './shared/config/env.js';
import { configurarApp } from './shared/bootstrap.js';
async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configurarApp(app, env);
  await app.listen(env.PORT);
}
await bootstrap();
