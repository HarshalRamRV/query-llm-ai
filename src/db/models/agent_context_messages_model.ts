import mongoose, { Document, Schema } from 'mongoose';

// Sub-schemas for content parts
const text_part_schema = new Schema(
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

const tool_call_part_schema = new Schema(
  {
    type: {
      type: String,
      enum: ['tool-call'],
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
    args: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

const tool_result_part_schema = new Schema(
  {
    type: {
      type: String,
      enum: ['tool-result'],
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
    result: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

const image_part_schema = new Schema(
  {
    type: {
      type: String,
      enum: ['image'],
      required: true,
    },
    image: {
      type: Schema.Types.Mixed, // string (base64) | Buffer
      required: true,
    },
    mimeType: {
      type: String,
    },
  },
  { _id: false }
);

const file_part_schema = new Schema(
  {
    type: {
      type: String,
      enum: ['file'],
      required: true,
    },
    data: {
      type: Schema.Types.Mixed, // string (base64) | Buffer
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

// Message schemas
const agent_model_message_schema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['system', 'user', 'assistant', 'tool'],
      required: true,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Main agent_context_messages document
export interface agent_context_messages_document extends Document {
  conversation_id: mongoose.Types.ObjectId;
  content: Array<{
    id: string;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | Array<unknown>;
    created_at: Date;
  }>;
  created_at: Date;
  updated_at: Date;
}

const agent_context_messages_schema = new Schema(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      unique: true,
      index: true,
    },
    content: {
      type: [agent_model_message_schema],
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

export const agent_context_messages_model = mongoose.model<agent_context_messages_document>(
  'AgentContextMessages',
  agent_context_messages_schema
);
