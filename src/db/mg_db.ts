import { user_model } from '@/db/models/user_model';
import { conversation_model } from '@/db/models/conversation_model';
import { user_context_messages_model } from '@/db/models/user_context_messages_model';
import { agent_context_messages_model } from '@/db/models/agent_context_messages_model';

export const mg_db = {
  user_model,
  conversation_model,
  user_context_messages_model,
  agent_context_messages_model,
};

export type { user_document } from '@/db/models/user_model';
export type { conversation_document } from '@/db/models/conversation_model';
export type { user_context_messages_document } from '@/db/models/user_context_messages_model';
export type { agent_context_messages_document } from '@/db/models/agent_context_messages_model';
