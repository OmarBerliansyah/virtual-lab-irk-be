import { Schema, model, Document } from 'mongoose';

export interface IAssistant extends Document {
  name: string;
  email: string;
  nim: string;
  angkatan: string;
  role: string;
  image?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assistantSchema = new Schema<IAssistant>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\d{8}@std\.stei\.itb\.ac\.id$/, 'Please provide a valid ITB student email'],
  },
  nim: {
    type: String,
    required: true,
    unique: true,
    match: [/^\d{8}$/, 'Please provide a valid 8-digit NIM'],
  },
  angkatan: {
    type: String,
    required: true,
    enum: ['IF\'20', 'IF\'21', 'IF\'22', 'IF\'23', 'IF\'24', 'IF\'25'], // Can be extended
  },
  role: {
    type: String,
    required: true,
    default: 'Assistant',
    enum: [
      'Assistant', 
      'Head Assistant', 
      'Research Assistant', 
      'Teaching Assistant',
      'Lab Assistant'
    ],
  },
  image: {
    type: String,
    default: 'https://media.istockphoto.com/id/1477583639/vector/user-profile-icon-vector-avatar-or-person-icon-profile-picture-portrait-symbol-vector.jpg?s=612x612&w=0&k=20&c=OWGIPPkZIWLPvnQS14ZSyHMoGtVTn1zS8cAgLy1Uh24=',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
});

assistantSchema.index({ angkatan: 1 });
assistantSchema.index({ isActive: 1 });

// Pre-save middleware to extract angkatan from NIM
assistantSchema.pre<IAssistant>('save', function(next) {
  if (this.nim && this.nim.length === 8) {
    const angkatanDigits = this.nim.substring(3, 5);
    this.angkatan = `IF'${angkatanDigits}`;
  }
  next();
});

export const Assistant = model<IAssistant>('Assistant', assistantSchema);