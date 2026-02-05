import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const env_schema = z.object({
  PORT: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
  BACKEND_API_URL: z.string().min(1, 'BACKEND_API_URL is required'),
  DEFAULT_MODEL: z.string().min(1, 'DEFAULT_MODEL is required'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  AI_DEBUG_STREAM: z.string().optional(),
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
