import { Schema, model, Document } from 'mongoose';

interface ITask extends Document {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'To Do' | 'In Progress' | 'Done';
  dueDate?: Date;
  assignee?: string;
  tags: string[];
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Done'],
      default: 'To Do',
      index: true,
    },
    dueDate: { type: Date },
    assignee: { type: String },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

export const Task = model<ITask>('Task', taskSchema);
export type { ITask };