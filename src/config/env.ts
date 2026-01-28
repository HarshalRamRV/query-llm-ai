import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const env_schema = z.object({
  PORT: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().default('*'),
});

const parsed_env = env_schema.safeParse(process.env);

if (!parsed_env.success) {
  console.error('Invalid environment variables:');
  console.error(parsed_env.error.format());
  process.exit(1);
}

export const env = parsed_env.data;

export const is_production = env.NODE_ENV === 'production';
export const is_development = env.NODE_ENV === 'development';
export const is_test = env.NODE_ENV === 'test';
