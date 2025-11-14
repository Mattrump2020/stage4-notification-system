import express from 'express';
import { connectDB } from '../../common/src/utils/db.js';
import logger from '../../common/src/utils/logger.js';
import { successResponse, errorResponse } from '../../common/src/utils/response.js';
import User from './models/user.model.js';

const app = express();
app.use(express.json());

// --- Health Check ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- API Endpoints ---
app.post('/api/v1/users', async (req, res) => {
  try {
    const { name, email, password, push_token, preferences } = req.body;
    
    const newUser = await User.create({
      name,
      email,
      password,
      push_token,
      preferences,
    });
    
    newUser.password = undefined; 
    return successResponse(res, 201, 'User created successfully', newUser);
  } catch (err) {
    logger.error('User creation failed', { error: err.message });
    if (err.code === 11000) {
      return errorResponse(res, 400, 'Email already exists');
    }
    return errorResponse(res, 500, 'Server error', err.message);
  }
});

app.get('/api/v1/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    return successResponse(res, 200, 'User retrieved', user);
  } catch (err) {
    logger.error('User retrieval failed', { error: err.message });
    return errorResponse(res, 500, 'Server error', err.message);
  }
});

// ... other endpoints (login, update preferences, etc.) ...

// --- Start Server ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

connectDB(MONGO_URI).then(() => {
  app.listen(PORT, () => {
    logger.info(`User Service running on port ${PORT}`);
  });
});