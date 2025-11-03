import { Schema, model, Document } from 'mongoose';

interface IUser extends Document {
  clerkId: string;
  email: string;
  role: 'user' | 'assistant' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  clerkId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true },
  role: {
    type: String,
    enum: ['user', 'assistant', 'admin'],
    default: 'user'
  }
}, { timestamps: true });

export const User = model<IUser>('User', userSchema);
export type { IUser };