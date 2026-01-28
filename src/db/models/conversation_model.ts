import mongoose, { Document, Schema } from 'mongoose';

export interface conversation_document extends Document {
  user_id: mongoose.Types.ObjectId;
  conversation_id: string; // UUID from frontend
  title: string;
  ai_model: string;
  status: 'active' | 'archived';
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const conversation_schema = new Schema<conversation_document>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversation_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    ai_model: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    toJSON: {
      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return { id: (_id as mongoose.Types.ObjectId).toString(), ...rest };
      },
    },
  }
);

// Index for soft delete queries
conversation_schema.index({ user_id: 1, deleted_at: 1 });

export const conversation_model = mongoose.model<conversation_document>(
  'Conversation',
  conversation_schema
);
