import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { api_error } from '@/utils/api_error';

type provider_key = 'openai' | 'anthropic' | 'gemini';

const providers: Record<provider_key, (model: string) => unknown> = {
  openai,
  anthropic,
  gemini: google,
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
  const model_name = normalized.slice(separator_index + 1);

  if (!providers[provider]) {
    throw api_error.bad_request(`Unsupported model provider: ${provider}`);
  }

  if (!model_name) {
    throw api_error.bad_request('Model name is required');
  }

  return {
    provider,
    model_name,
    model: providers[provider](model_name),
  };
};
