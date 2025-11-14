import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userPreferenceSchema = new mongoose.Schema({
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  push_token: { type: String, sparse: true },
  preferences: { type: userPreferenceSchema, default: () => ({}) },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', userSchema);
export default User;