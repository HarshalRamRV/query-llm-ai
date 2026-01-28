import mongoose, { Document, Schema } from 'mongoose';

// Sub-schemas for UI message parts
const ui_text_part_schema = new Schema(
  {
    type: {
      type: String,
      enum: ['text'],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const ui_tool_invocation_part_schema = new Schema(
  {
    type: {
      type: String,
      enum: ['tool-invocation'],
      required: true,
    },
    toolCallId: {
      type: String,
      required: true,
    },
    toolName: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      enum: ['call', 'result', 'partial-call'],
      required: true,
    },
    args: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    result: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { _id: false }
);

// UI User Message schema
const ui_user_message_schema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// UI Assistant Message schema
const ui_assistant_message_schema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    parts: {
      type: [ui_text_part_schema, ui_tool_invocation_part_schema],
      default: [],
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Main user_context_messages document
export interface user_context_messages_document extends Document {
  conversation_id: mongoose.Types.ObjectId;
  content: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    parts?: Array<{
      type: 'text' | 'tool-invocation';
      text?: string;
      toolCallId?: string;
      toolName?: string;
      state?: 'call' | 'result' | 'partial-call';
      args?: unknown;
      result?: unknown;
    }>;
    created_at: Date;
  }>;
  created_at: Date;
  updated_at: Date;
}

const user_context_messages_schema = new Schema(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      unique: true,
      index: true,
    },
    content: {
      type: [ui_user_message_schema, ui_assistant_message_schema],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

export const user_context_messages_model = mongoose.model<user_context_messages_document>(
  'UserContextMessages',
  user_context_messages_schema
);
