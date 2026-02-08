import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { api_error } from '@/utils/api_error';

type provider_key = 'openai' | 'anthropic' | 'gemini';

// Initialize Google provider with custom API key
const getGoogleProvider = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw api_error.bad_request('GEMINI_API_KEY environment variable is required for Gemini models');
  }
  return createGoogleGenerativeAI({ apiKey });
};

const providers: Record<provider_key, (model: string) => unknown> = {
  openai: (model: string) => openai(model),
  anthropic: (model: string) => anthropic(model),
  gemini: (model: string) => getGoogleProvider()(model),
};

export const resolve_model = (
  requested_model: string,
  default_model: string
): { provider: provider_key; model_name: string; model: unknown } => {
  const normalized = requested_model && requested_model !== 'default' ? requested_model : default_model;
  const separator_index = normalized.indexOf(':');

  if (separator_index === -1) {
    throw api_error.bad_request('Model must be in provider:model format');
  }

  const provider = normalized.slice(0, separator_index) as provider_key;
  let model_name = normalized.slice(separator_index + 1);

  if (!providers[provider]) {
    throw api_error.bad_request(`Unsupported model provider: ${provider}`);
  }

  if (!model_name) {
    throw api_error.bad_request('Model name is required');
  }

  // Google AI SDK requires 'models/' prefix
  if (provider === 'gemini' && !model_name.startsWith('models/')) {
    model_name = `models/${model_name}`;
  }

  console.log('[ModelResolver] Resolving:', { provider, model_name, original: requested_model });

  return {
    provider,
    model_name,
    model: providers[provider](model_name),
  };
};
