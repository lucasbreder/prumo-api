import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().optional(),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET deve ter no minimo 256 bits (32 chars)'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(90).default(30),
  RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  WEBHOOK_SECRET: z
    .string()
    .min(16, 'WEBHOOK_SECRET deve ter no minimo 16 chars'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  // Social login (Google/Apple) OAuth client ids — optional: when absent the
  // corresponding provider endpoint returns 503 (feature disabled).
  GOOGLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
});
export type AppEnv = z.infer<typeof EnvSchema>;
export const ENV_TOKEN = 'ENV' as const;
export function parseEnv(raw: NodeJS.ProcessEnv): AppEnv {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuracao de ambiente invalida -> ${summary}`);
  }
  return parsed.data;
}
export function loadEnv(): AppEnv {
  dotenvConfig();
  return parseEnv(process.env);
}
