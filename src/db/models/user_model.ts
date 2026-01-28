import mongoose, { Document, Schema } from 'mongoose';

export interface user_document extends Document {
  firebase_uid: string;
  name: string;
  email: string;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const user_schema = new Schema<user_document>(
  {
    firebase_uid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
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
        return { id: _id.toString(), ...rest };
      },
    },
  }
);

export const user_model = mongoose.model<user_document>('User', user_schema);
