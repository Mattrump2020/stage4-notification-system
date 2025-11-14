import mongoose from 'mongoose';
import logger from './logger.js';

export const connectDB = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri);
    logger.info('MongoDB Connected successfully.');
  } catch (err) {
    logger.error('MongoDB Connection Error:', err);
    // Exit process with failure
    process.exit(1);
  }
};