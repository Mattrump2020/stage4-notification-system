import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  template_code: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  language: { type: String, default: 'en' },
  version: { type: Number, default: 1 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Template = mongoose.model('Template', templateSchema);
export default Template;