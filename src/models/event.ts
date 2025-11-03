import { Schema, model, Document } from 'mongoose';

interface IEvent extends Document {
  title: string;
  start: Date;
  end?: Date;
  course: string;
  type: 'deadline' | 'release' | 'assessment';
}

const eventSchema = new Schema<IEvent>({
  title: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date },
  course: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: ['deadline', 'release', 'assessment'],
    required: true,
  },
}, { timestamps: true });

export const Event = model<IEvent>('Event', eventSchema);
export type { IEvent };